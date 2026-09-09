// @flow

// A hitbox offset with its DEPTH kept.
//
// `x` and `y` mean exactly what they mean on a Vec2D -- meleelight's horizontal
// and vertical -- so anything that already reads `.x` and `.y` off an offset
// keeps working unchanged. `z` is the third axis, which is Melee's X.
//
// The naming is confusing and worth stating plainly: meleelight's horizontal is
// Melee's Z, and the axis meleelight has no notion of is Melee's X. So this
// class's (x, y, z) is Melee's (Z, Y, X). See tools/README.md.
//
// The depth is here because hurtboxes need it. Melee's collision is 3D, and
// limbs swing several units through the depth axis -- more than a hitbox's own
// radius -- so a hit that connects in a flattened 2D world can miss in Melee.
// Both fighters sit at depth 0; all of it comes from the animations.

export class Vec3D { x : number; y : number; z : number;
  constructor( x : number, y : number, z : number ) {
    this.x = x;
    this.y = y;
    this.z = z;
  };
  dot( vector : Vec3D) : number {
    return this.x * vector.x + this.y * vector.y + this.z * vector.z;
  };
};
