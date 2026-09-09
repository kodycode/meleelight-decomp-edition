"""float32 arithmetic and Melee's own trigonometry, for the offline tools.

The tools compute joint matrices to decide what to write into meleelight's
tables. The console computes those matrices in float32 on the Gekko, using
Metrowerks' polynomial sinf/cosf -- so a float64 computation with libm's sin
and cos does not produce the numbers the game produces. It is close, but
"close" is what this whole effort exists to stop settling for.

Two separate things are needed and both are here:

  * f32 arithmetic. Every intermediate is rounded to float32 after each
    operation, exactly as the hardware does.
  * sinf/cosf. NOT round(sin(x)) -- the console does not compute the exact sine
    and then round it, it runs a polynomial. Rounding libm's answer is a
    DOUBLE rounding of a different number.

This is the same port as src/physics/trig.js, from the same source, kept in
step with it deliberately: src/MSL/trigf.c (sinf :24, cosf :68) and
src/MSL/math_data.c (__sincos_on_quadrant :69, __sincos_poly :71).

Every operation below is a float32 +, - or *, so the result is bit-exact
against the hardware rather than merely close to it.
"""
import math
import struct

_PACK = struct.Struct("<f")
_IPACK = struct.Struct("<i")


def f32(x):
    """Round a Python float to float32, as storing it in a float register does."""
    return _PACK.unpack(_PACK.pack(x))[0]


def add(a, b):
    return f32(a + b)


def sub(a, b):
    return f32(a - b)


def mul(a, b):
    return f32(a * b)


def hi_word(x):
    """The raw bit pattern, used only for its sign bit -- `x < 0` gets negative
    zero wrong, and the reduction below branches on exactly that."""
    return _IPACK.unpack(_PACK.pack(x))[0]


# math_data.c:69
ON_QUADRANT = [0, 1, 1, 0, 0, -1, -1, 0]

# math_data.c:71
POLY = [f32(v) for v in (
    0.0000035287617, 0.0000003089747, -0.0003259365,
    -0.00003657235, 0.015854323, 0.0024903931,
    -0.30842513, -0.08074551, 1.0,
    0.7853982,
)]

# trigf.c:10, copied into __four_over_pi_m1 by the static initialiser at :14.
FOUR_OVER_PI_M1 = [f32(v) for v in (
    0.25, 0.0232393741608, 1.70555722434e-7, 1.86736494323e-11,
)]

EPSILON = f32(3.45266983e-4)              # trigf.c:3
TWO_OVER_PI = f32(2.0 / f32(math.pi))     # trigf.c:31, (2.0f/(f32)M_PI)


def _reduce(x):
    """Shared argument reduction, trigf.c:31-36 and :75-80."""
    z = mul(TWO_OVER_PI, x)
    # C truncates toward zero on the float->int cast.
    if hi_word(x) & -0x80000000:
        n0 = math.trunc(sub(z, f32(0.5)))
    else:
        n0 = math.trunc(add(z, f32(0.5)))
    y = sub(x, f32(n0 * 2))
    for a in FOUR_OVER_PI_M1:
        y = add(y, mul(a, x))
    return n0 & 3, y


def _poly_even(ysq):
    z = add(mul(POLY[0], ysq), POLY[2])
    z = add(mul(z, ysq), POLY[4])
    z = add(mul(z, ysq), POLY[6])
    return add(mul(z, ysq), POLY[8])


def _poly_odd(ysq, y):
    z = add(mul(POLY[1], ysq), POLY[3])
    z = add(mul(z, ysq), POLY[5])
    z = add(mul(z, ysq), POLY[7])
    z = add(mul(z, ysq), POLY[9])
    return mul(z, y)


def sinf(x):
    """trigf.c:24."""
    n, y = _reduce(f32(x))
    if abs(y) < EPSILON:
        i = n << 1
        return add(ON_QUADRANT[i], mul(mul(ON_QUADRANT[i + 1], y), POLY[9]))
    ysq = mul(y, y)
    if n & 1:
        return mul(_poly_even(ysq), ON_QUADRANT[n << 1])
    return mul(_poly_odd(ysq, y), ON_QUADRANT[(n << 1) + 1])


def cosf(x):
    """trigf.c:68."""
    n, y = _reduce(f32(x))
    if abs(y) < EPSILON:
        i = n << 1
        return sub(ON_QUADRANT[i + 1], mul(y, ON_QUADRANT[i]))
    ysq = mul(y, y)
    if n & 1:
        return mul(-_poly_odd(ysq, y), ON_QUADRANT[n << 1])
    return mul(_poly_even(ysq), ON_QUADRANT[(n << 1) + 1])


def shortest(x):
    """The shortest decimal string that round-trips to this exact float32.

    Writing "%.2f" throws away precision the computation actually has -- two
    decimals is a hundredth of a unit of self-inflicted error on top of
    whatever the model's own is. Nine significant digits always round-trip a
    float32, and most values need far fewer, so this asks for the fewest that
    reproduce the value exactly.
    """
    v = f32(x)
    if v == 0.0:
        return "0"
    for p in range(1, 10):
        s = "%.*g" % (p, v)
        if f32(float(s)) == v:
            break
    # Trim the forms that are longer than they need to be, without changing
    # what the string parses to.
    if "e" not in s and "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"
