// Minimal Flow type-annotation stripper.
//
// WHY: physics.js and hitDetection.js -- the two largest physics files -- carry
// Flow annotations, which bare Node cannot parse. That made them invisible to
// the harness, and a missing import in hitDetection.js once slipped through
// precisely because the tests could not load it.
//
// This is NOT a general Flow implementation. It handles the constructs those
// files actually use, and the harness verifies the output parses. If a future
// file uses something this misses, the loader will throw a SyntaxError naming
// the file -- a loud failure, not a silent one.
//
// Deliberately conservative: annotations are only removed in positions where a
// colon cannot mean something else. Object literals ({a: 1}), ternaries
// (c ? a : b), switch-case labels and class fields are left untouched.

// Consume a balanced run of brackets/parens/angles starting at `i`.
function matchDelim(src, i, open, close) {
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === open) { depth++; }
    else if (c === close) { depth--; if (!depth) { return i + 1; } }
    else if (c === '"' || c === "'" || c === "`") { i = skipString(src, i); }
  }
  return i;
}

function skipString(src, i) {
  const q = src[i];
  for (i++; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === q) { return i; }
  }
  return i;
}

// Balanced angle brackets. NOT matchDelim(src, i, "<", ">") -- the ">" of an
// arrow inside a type parameter closes the wrong bracket:
//
//   $ObjMap<T, <V>(_: V) => V>
//                       ^^ this ">" is part of "=>", not a closer
//
// Counting it drops the depth to zero early and leaves " V>" stranded in the
// output, which is exactly how main/util/deepCopy.js failed to parse.
function matchAngle(src, i) {
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(src, i); continue; }
    if (c === "=" && src[i + 1] === ">") { i++; continue; }
    if (c === "<") { depth++; }
    else if (c === ">") { depth--; if (!depth) { return i + 1; } }
  }
  return i;
}

// Read one type expression starting at `i` (after the colon). Returns the index
// just past it. Handles: Foo, Foo.Bar, Foo<A,B>, {a: N}, [A, B], A | B, ?Foo,
// Array<...>, and function types (A) => B.
function endOfType(src, i) {
  const n = src.length;
  for (;;) {
    while (i < n && /\s/.test(src[i])) { i++; }
    if (src[i] === "?") { i++; continue; }
    if (src[i] === "{") { i = matchDelim(src, i, "{", "}"); }
    else if (src[i] === "[") { i = matchDelim(src, i, "[", "]"); }
    else if (src[i] === "(") {
      i = matchDelim(src, i, "(", ")");
      const save = i;
      while (i < n && /\s/.test(src[i])) { i++; }
      if (src.startsWith("=>", i)) { i += 2; continue; }
      i = save;
    } else if (src[i] === '"' || src[i] === "'") {
      // String-literal type, e.g.  controllerInfo : "keyboard" | GamepadInfo
      i = skipString(src, i) + 1;
    } else if (/[0-9]/.test(src[i] || "")
               || (/[-+]/.test(src[i] || "") && /[0-9]/.test(src[i + 1] || ""))) {
      // Numeric-literal type, e.g.  mode : 0 | 1 | 2  or  sign : 1 | -1
      // The leading-sign case matters: without it the scanner stops after
      // "1 |" in `parseSign(s : string) : 1 | -1`, leaving a bare "-1" where a
      // function body should start (stages/encode.js).
      const m = /^[-+]?[0-9][0-9.eE]*/.exec(src.slice(i));
      i += m ? m[0].length : 1;
    } else {
      const m = /^[A-Za-z_$][\w$.]*/.exec(src.slice(i));
      if (!m) { return i; }
      i += m[0].length;
      while (i < n && /\s/.test(src[i])) { i++; }
      if (src[i] === "<") { i = matchAngle(src, i); }
    }
    // union / intersection continues the type
    const save = i;
    while (i < n && /\s/.test(src[i])) { i++; }
    if (src[i] === "|" || src[i] === "&") {
      // `|` inside a type, not a bitwise op -- only valid here because we are
      // scanning a known annotation position.
      i++;
      continue;
    }
    return save;
  }
}

// Strip `: Type` annotations at paren-depth 1 inside a parameter list that
// begins at `open` (index of the "(").
// A colon inside a parameter list means different things depending on the
// enclosing bracket:
//
//   (x: number)              -- annotation, strip
//   ([x: number, y: number]) -- annotation, strip (array patterns have no
//                               key:value form)
//   ({a: b})                 -- destructuring RENAME, must be kept
//
// So track the enclosing delimiter, not merely the depth. Stripping by depth
// alone silently rewrites `{a: b}` to `{a}`, which still parses and changes
// behaviour -- the worst kind of bug for a harness to introduce.
function stripParams(src, open) {
  const close = matchDelim(src, open, "(", ")");
  let out = "";
  const stack = [];
  for (let i = open; i < close; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const e = skipString(src, i);
      out += src.slice(i, e + 1); i = e; continue;
    }
    if (c === "(" || c === "[" || c === "{") { stack.push(c); out += c; continue; }
    if (c === ")" || c === "]" || c === "}") { stack.pop(); out += c; continue; }
    if (c === ":" && stack.length && stack[stack.length - 1] !== "{") {
      i = endOfType(src, i + 1) - 1;   // drop the annotation
      continue;
    }
    out += c;
  }
  return { text: out, end: close };
}

// `type X = <type>` / `export type X = <type>`, semicolon OPTIONAL.
//
// This must balance delimiters rather than regex to the next ";". Flow allows
// a multi-line alias with no terminator:
//
//   type AABBCheck = { case : "corner", ... }
//                  | { case : "line", ... }
//
// A regex ending at the next ";" swallows everything up to the next statement
// -- including the following function's header, which orphans its `return` and
// produces a baffling "Illegal return statement".
function stripTypeAliases(src) {
  const re = /(?:^|\n)[ \t]*(?:export[ \t]+)?type[ \t]+\w+[ \t]*(?:<[^>]*>)?[ \t]*=/g;
  let out = "", i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) { out += src.slice(i); break; }
    out += src.slice(i, m.index);
    let j = endOfType(src, m.index + m[0].length);
    while (j < src.length && /[ \t]/.test(src[j])) { j++; }
    if (src[j] === ";") { j++; }
    out += "\n";
    i = j;
  }
  return out;
}

// `const name: Type = ...`, `let name: Type`, including multi-line types
// such as `const ecbSquashData: [ SquashDatum\n , SquashDatum ] = ...`.
function stripVarAnnotations(src) {
  const re = /\b(?:const|let|var)[ \t]+[A-Za-z_$][\w$]*[ \t]*:/g;
  let out = "", i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) { out += src.slice(i); break; }
    const colon = m.index + m[0].length - 1;
    out += src.slice(i, colon);
    i = endOfType(src, colon + 1);
  }
  return out;
}

// Generic type-parameter lists on function declarations:
//   function firstNonNull<T>( ... )        -> function firstNonNull( ... )
//   function deepCopyArray<T : Array<*>>() -> function deepCopyArray()
//
// Still a targeted pre-pass, not a rule inside the parameter scanner. An
// earlier attempt to handle generics in the scanner itself recovered two
// utility files but silently REGRESSED environmentalCollision.js, a physics
// file that had been parsing -- caught only because the tree-wide check exists.
// Keeping it narrow keeps that blast radius impossible.
//
// This balances angle brackets rather than using a character class. The old
// `<[^<>()]*>` could not cross a NESTED type argument, so a bound like
// `<T : Array<*>>` was left in place entirely.
//
// The `(` requirement after the closing `>` is the safety check: it is what
// distinguishes a generic parameter list from a less-than comparison. Combined
// with the preceding `function NAME`, a false positive is not reachable.
function stripFunctionGenerics(src) {
  const re = /\bfunction\b\s*\*?\s*[A-Za-z_$][\w$]*\s*</g;
  let out = "", i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) { out += src.slice(i); break; }
    const lt = m.index + m[0].length - 1;      // index of "<"
    const gt = matchAngle(src, lt);            // just past the matching ">"
    let j = gt;
    while (j < src.length && /\s/.test(src[j])) { j++; }
    if (src[j] !== "(") {                      // not a generic list -- leave it
      out += src.slice(i, gt);
      i = gt;
      continue;
    }
    out += src.slice(i, lt);                   // drop "<...>"
    i = gt;
  }
  return out;
}

// Class bodies: field annotations, method parameters and method return types.
//
// An earlier attempt at this was deleted, and for a good reason: a rule
// matching "identifier : type ;" ANYWHERE also matches the tail of a ternary,
// `cond ? a : false;`, and silently rewrites it to `a;` -- code that still
// parses but no longer means the same thing.
//
// The fix is scope, not a cleverer pattern. A class body may contain only
// method definitions, field definitions and static blocks -- it cannot contain
// an expression statement, so a ternary CANNOT occur at class-body top level.
// Descend into a class body and a colon found there, outside any (), [] or {},
// is unambiguously a Flow annotation.
//
// Method signatures need handling here too: the function scanner keys on the
// `function` keyword, which class methods do not have, so `constructor(x :
// number)` was never reached by it.
function stripClassBodies(src) {
  const re = /\bclass\b/g;
  let out = "", i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) { out += src.slice(i); break; }

    // Find the "{" that opens the body, skipping `extends Foo<Bar>`.
    let j = m.index + m[0].length;
    while (j < src.length && src[j] !== "{" && src[j] !== ";") { j++; }
    if (src[j] !== "{") { out += src.slice(i, j); i = j; continue; }

    const bodyEnd = matchDelim(src, j, "{", "}");
    out += src.slice(i, j + 1);
    out += stripClassBody(src, j + 1, bodyEnd - 1);
    out += "}";
    i = bodyEnd;
  }
  return out;
}

// Walk one class body [from, to). Depth 0 here IS class-body top level.
function stripClassBody(src, from, to) {
  let out = "";
  for (let k = from; k < to; k++) {
    const c = src[k];
    if (c === '"' || c === "'" || c === "`") {
      const e = skipString(src, k);
      out += src.slice(k, e + 1); k = e; continue;
    }
    if (c === "(") {
      // Method parameter list, then an optional `) : Type` return annotation.
      const { text, end } = stripParams(src, k);
      out += text;
      let j = end;
      while (j < src.length && /\s/.test(src[j])) { j++; }
      if (src[j] === ":") { out += " "; k = endOfType(src, j + 1) - 1; }
      else { k = end - 1; }
      continue;
    }
    if (c === "[") {                 // computed key -- may hold a ternary
      const e = matchDelim(src, k, "[", "]");
      out += src.slice(k, e); k = e - 1; continue;
    }
    if (c === "{") {                 // method body / static block -- copy as-is
      const e = matchDelim(src, k, "{", "}");
      out += src.slice(k, e); k = e - 1; continue;
    }
    if (c === ":") { k = endOfType(src, k + 1) - 1; continue; }
    out += c;
  }
  return out;
}

export function stripFlow(src) {
  // `import type ...` / `import typeof ...`, semicolon optional
  src = src.replace(/^[ \t]*import[ \t]+type[ \t][^;\n]*;?[ \t]*$/gm, "");
  src = src.replace(/^[ \t]*import[ \t]+typeof[ \t][^;\n]*;?[ \t]*$/gm, "");
  // Flow ambient declarations: `declare var x;`, `declare function f(...): T;`
  src = src.replace(
    /^[ \t]*declare[ \t]+(?:var|let|const|function|class|module|type)[ \t][^\n]*$/gm,
    "");
  src = stripFunctionGenerics(src);

  src = stripTypeAliases(src);
  src = stripVarAnnotations(src);
  // Before the function scanner: class method bodies are copied verbatim here,
  // and the scanner then runs over the whole result to reach any `function`
  // declarations nested inside them.
  src = stripClassBodies(src);

  let out = "";
  let i = 0;
  const fnRe = /\bfunction\b\s*\*?\s*[A-Za-z_$][\w$]*?\s*\(|\bfunction\b\s*\*?\s*\(/g;

  for (;;) {
    fnRe.lastIndex = i;
    const m = fnRe.exec(src);
    if (!m) { out += src.slice(i); break; }

    const open = m.index + m[0].length - 1;   // index of "("
    out += src.slice(i, open);

    const { text, end } = stripParams(src, open);
    out += text;

    // return type: `) : Type {`
    let j = end;
    while (j < src.length && /\s/.test(src[j])) { j++; }
    if (src[j] === ":") {
      const te = endOfType(src, j + 1);
      out += " ";
      i = te;
    } else {
      i = end;
    }
  }
  return out;
}
