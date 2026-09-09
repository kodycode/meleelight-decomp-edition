import WAIT from "characters/shared/moves/WAIT";
import {player} from "main/main";
import {sounds} from "main/sfx";
import {setGroundVelocity} from "physics/groundMovement";
export default {
  name : "APPEAL",
  canEdgeCancel : false,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "APPEAL";
    player[p].timer = 0;
    setGroundVelocity(p, 0);
    sounds.falcontaunt.play();
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 60) {
      WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
