"""Build a 2D silhouette outline from a posed fighter model.

meleelight draws a character as a filled vector path per frame
(render.js:37 drawArrayPathCompress): entry 0,1 is a moveTo and every following
group of 6 numbers is a cubic bezier. The paths in src/animations were traced
off rendered frames, so regenerating one means rebuilding the shape the model
actually makes.

PROJECTION AND SCALE, both derived rather than fitted:

  * Melee's fighters face along Z, so the side-on plane meleelight works in is
    (Z, Y) -- the same projection tools/bake_offsets.py uses for hitboxes.
  * Screen Y points down, so model Y is negated.
  * render.js:247 draws the path with
        scaleX = charAttributes.charScale * (activeStage.scale / 4.5)
    and a position with `pos * activeStage.scale`, so for the drawing to be in
    proportion one game unit must be activeStage.scale / charScale path units.
    At the reference stage scale of 4.5 that is 4.5 / charScale -- 9.278 for
    Falcon's charScale of 0.485.

The outline itself is the boundary of the union of the model's posed triangles.
That is done by rasterising the triangles into a mask and walking the boundary,
which is what tracing a rendered frame did originally, rather than by trying to
union polygons analytically.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def project(tris, scale):
    """World triangles -> 2D path-space triangles (Melee Z,Y -> path x,y)."""
    out = []
    for a, b, c in tris:
        out.append(((a[2] * scale, -a[1] * scale),
                    (b[2] * scale, -b[1] * scale),
                    (c[2] * scale, -c[1] * scale)))
    return out


try:
    from PIL import Image, ImageDraw
except ImportError:                                   # pragma: no cover
    Image = None


def rasterize(tris2d, res, bounds=None, pad=2):
    """Fill triangles into a boolean mask. Returns (mask, w, h, ox, oy, res).

    `res` is mask cells per path unit. Coordinates map as
        col = (x - ox) * res,  row = (y - oy) * res

    Uses PIL's C polygon fill when available -- a model frame is ~8000
    triangles and a pure-Python scanline over all of them is far too slow to
    run over a hundred frames.
    """
    if bounds is None:
        xs = [p[0] for t in tris2d for p in t]
        ys = [p[1] for t in tris2d for p in t]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    else:
        minx, maxx, miny, maxy = bounds
    ox = minx - pad / res
    oy = miny - pad / res
    w = int(math.ceil((maxx - minx) * res)) + 2 * pad + 1
    h = int(math.ceil((maxy - miny) * res)) + 2 * pad + 1
    if Image is not None:
        img = Image.new("1", (w, h), 0)
        d = ImageDraw.Draw(img)
        for (ax, ay), (bx, by), (cx, cy) in tris2d:
            d.polygon([((ax - ox) * res, (ay - oy) * res),
                       ((bx - ox) * res, (by - oy) * res),
                       ((cx - ox) * res, (cy - oy) * res)], fill=1)
        return bytearray(img.tobytes("raw", "L")), w, h, ox, oy, res

    mask = bytearray(w * h)

    for (ax, ay), (bx, by), (cx, cy) in tris2d:
        axp = (ax - ox) * res
        ayp = (ay - oy) * res
        bxp = (bx - ox) * res
        byp = (by - oy) * res
        cxp = (cx - ox) * res
        cyp = (cy - oy) * res
        lo_y = max(0, int(math.floor(min(ayp, byp, cyp))))
        hi_y = min(h - 1, int(math.ceil(max(ayp, byp, cyp))))
        lo_x = max(0, int(math.floor(min(axp, bxp, cxp))))
        hi_x = min(w - 1, int(math.ceil(max(axp, bxp, cxp))))
        if hi_x < lo_x or hi_y < lo_y:
            continue
        d = ((byp - cyp) * (axp - cxp) + (cxp - bxp) * (ayp - cyp))
        if abs(d) < 1e-12:
            continue
        inv = 1.0 / d
        for row in range(lo_y, hi_y + 1):
            py = row + 0.5
            base = row * w
            for col in range(lo_x, hi_x + 1):
                px = col + 0.5
                l1 = ((byp - cyp) * (px - cxp) + (cxp - bxp) * (py - cyp)) * inv
                if l1 < 0 or l1 > 1:
                    continue
                l2 = ((cyp - ayp) * (px - cxp) + (axp - cxp) * (py - cyp)) * inv
                if l2 < 0 or l2 > 1:
                    continue
                if l1 + l2 > 1:
                    continue
                mask[base + col] = 1
    return mask, w, h, ox, oy, res


def fill_holes(mask, w, h):
    """Flood the outside, so interior gaps between meshes become solid.

    The traced originals are outlines of a rendered SHAPE, which has no holes
    where two body parts meet; a raw triangle raster can leave slivers.
    """
    outside = bytearray(w * h)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not mask[i] and not outside[i]:
                outside[i] = 1
                stack.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not mask[i] and not outside[i]:
                outside[i] = 1
                stack.append(i)
    while stack:
        i = stack.pop()
        x = i % w
        y = i // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not mask[j] and not outside[j]:
                    outside[j] = 1
                    stack.append(j)
    for i in range(w * h):
        if not mask[i] and not outside[i]:
            mask[i] = 1
    return mask


def largest_component(mask, w, h):
    """Keep only the biggest connected blob, dropping stray specks."""
    seen = bytearray(w * h)
    best, best_size = None, 0
    for start in range(w * h):
        if mask[start] and not seen[start]:
            stack = [start]
            seen[start] = 1
            comp = []
            while stack:
                i = stack.pop()
                comp.append(i)
                x = i % w
                y = i // w
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if mask[j] and not seen[j]:
                            seen[j] = 1
                            stack.append(j)
            if len(comp) > best_size:
                best, best_size = comp, len(comp)
    out = bytearray(w * h)
    if best:
        for i in best:
            out[i] = 1
    return out


def trace_contour(mask, w, h):
    """Moore-neighbour boundary trace of the mask, in cell coordinates."""
    start = None
    for i in range(w * h):
        if mask[i]:
            start = (i % w, i // w)
            break
    if start is None:
        return []

    nbrs = [(1, 0), (1, 1), (0, 1), (-1, 1),
            (-1, 0), (-1, -1), (0, -1), (1, -1)]

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and mask[y * w + x]

    contour = [start]
    cur = start
    back = 4                      # came from the left
    guard = 0
    limit = 8 * w * h
    while True:
        guard += 1
        if guard > limit:
            break
        found = False
        for k in range(8):
            d = (back + 1 + k) % 8
            nx = cur[0] + nbrs[d][0]
            ny = cur[1] + nbrs[d][1]
            if solid(nx, ny):
                back = (d + 4 + 1) % 8
                cur = (nx, ny)
                found = True
                break
        if not found:
            break
        if cur == start and len(contour) > 2:
            break
        contour.append(cur)
    return contour


def simplify(points, tol):
    """Ramer-Douglas-Peucker."""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = points[i]
        bx, by = points[j]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        worst, wi = -1.0, -1
        for k in range(i + 1, j):
            px, py = points[k]
            if den < 1e-12:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / den
            if d > worst:
                worst, wi = d, k
        if worst > tol and wi > 0:
            keep[wi] = True
            stack.append((i, wi))
            stack.append((wi, j))
    return [points[k] for k in range(len(points)) if keep[k]]


def to_path(points):
    """A closed polygon as meleelight's path format.

    Entry 0,1 is the start; each later vertex becomes a cubic bezier whose two
    control points sit on the segment, which draws as a straight line. The
    format is fixed by render.js:58, so a polygon has to be expressed this way
    rather than as bare points.
    """
    if not points:
        return []
    out = [int(round(points[0][0])), int(round(points[0][1]))]
    prev = points[0]
    for p in points[1:] + [points[0]]:
        c1 = (prev[0] + (p[0] - prev[0]) / 3.0, prev[1] + (p[1] - prev[1]) / 3.0)
        c2 = (prev[0] + 2 * (p[0] - prev[0]) / 3.0,
              prev[1] + 2 * (p[1] - prev[1]) / 3.0)
        out += [int(round(c1[0])), int(round(c1[1])),
                int(round(c2[0])), int(round(c2[1])),
                int(round(p[0])), int(round(p[1]))]
        prev = p
    return out


def flatten_path(path, steps=8):
    """meleelight path -> polygon points, for rasterising a baked outline."""
    if len(path) < 2:
        return []
    pts = [(path[0], path[1])]
    cur = pts[0]
    for k in range(2, len(path) - 5, 6):
        c1 = (path[k], path[k + 1])
        c2 = (path[k + 2], path[k + 3])
        p = (path[k + 4], path[k + 5])
        for s in range(1, steps + 1):
            t = s / steps
            mt = 1 - t
            x = (mt ** 3 * cur[0] + 3 * mt * mt * t * c1[0]
                 + 3 * mt * t * t * c2[0] + t ** 3 * p[0])
            y = (mt ** 3 * cur[1] + 3 * mt * mt * t * c1[1]
                 + 3 * mt * t * t * c2[1] + t ** 3 * p[1])
            pts.append((x, y))
        cur = p
    return pts


def polygon_mask(points, w, h, ox, oy, res):
    """Scanline-fill a polygon into an existing mask frame."""
    mask = bytearray(w * h)
    if len(points) < 3:
        return mask
    pts = [((x - ox) * res, (y - oy) * res) for x, y in points]
    if Image is not None:
        img = Image.new("1", (w, h), 0)
        ImageDraw.Draw(img).polygon(pts, fill=1)
        return bytearray(img.tobytes("raw", "L"))
    n = len(pts)
    for row in range(h):
        py = row + 0.5
        xs = []
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            if (y1 <= py < y2) or (y2 <= py < y1):
                t = (py - y1) / (y2 - y1)
                xs.append(x1 + t * (x2 - x1))
        xs.sort()
        base = row * w
        for i in range(0, len(xs) - 1, 2):
            a = max(0, int(math.ceil(xs[i] - 0.5)))
            b = min(w - 1, int(math.floor(xs[i + 1] - 0.5)))
            for c in range(a, b + 1):
                mask[base + c] = 1
    return mask


def iou(m1, m2):
    inter = 0
    union = 0
    for a, b in zip(m1, m2):
        if a or b:
            union += 1
            if a and b:
                inter += 1
    return (inter / union) if union else 0.0
