import { MatchEventType, MatchState } from '../types';

export type GoalkeeperDirection = 'CENTER' | 'LEFT_LOW' | 'LEFT_HIGH' | 'RIGHT_LOW' | 'RIGHT_HIGH';
export type GoalkeeperBodyMovement =
  | 'SET_POSITION'
  | 'SIDE_STEP'
  | 'FULL_STRETCH_DIVE'
  | 'LOW_DIVE'
  | 'VERTICAL_JUMP'
  | 'RUSH_AND_SPREAD'
  | 'CROSS_CLAIM_JUMP'
  | 'RECOVERY_STEP';
export type GoalkeeperHandUsage = 'NONE' | 'BOTH_HANDS' | 'LEFT_HAND' | 'RIGHT_HAND' | 'FISTS';
export type GoalkeeperResult = 'HELD' | 'PARRIED' | 'PUNCHED' | 'TIPPED_OVER' | 'DROPPED' | 'MISJUDGED' | 'BEATEN' | 'DISTRIBUTED';
export type ReboundRisk = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface GoalkeeperShotContext {
  eventType: 'SHOT' | 'HEADER' | 'CROSS' | 'PENALTY';
  shooterName: string;
  goalkeeperName: string;
  shotPower: number;
  shotAccuracy: number;
  shotHeight: number;
  shotDirection: GoalkeeperDirection;
  distanceToGoal: number;
  goalkeeperPosition: number;
  pressure: number;
  fatigue: number;
  weather?: 'CLEAR' | 'RAIN' | 'WIND';
  seedRoll: number;
}

export interface GoalkeeperStats {
  reflex: number;
  diving: number;
  handling: number;
  aerialReach: number;
  oneOnOne: number;
  composure: number;
}

export interface GoalkeeperActionEvent {
  type: MatchEventType;
  goalkeeperId: string;
  actionType: MatchEventType;
  direction: GoalkeeperDirection;
  bodyMovement: GoalkeeperBodyMovement;
  handUsage: GoalkeeperHandUsage;
  result: GoalkeeperResult;
  reboundRisk: ReboundRisk;
  commentary: string;
}

export interface GoalkeeperResolution {
  positioningEvent: GoalkeeperActionEvent;
  reactionEvent: GoalkeeperActionEvent;
  saveOrGoalResult: GoalkeeperActionEvent;
  reboundEvent?: GoalkeeperActionEvent;
  distributionEvent?: GoalkeeperActionEvent;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const handForDirection = (direction: GoalkeeperDirection): GoalkeeperHandUsage => {
  if (direction.startsWith('LEFT')) return 'LEFT_HAND';
  if (direction.startsWith('RIGHT')) return 'RIGHT_HAND';
  return 'BOTH_HANDS';
};

const sideText = (direction: GoalkeeperDirection) => {
  if (direction === 'LEFT_LOW') return 'sol alt köşeye';
  if (direction === 'LEFT_HIGH') return 'sol üst köşeye';
  if (direction === 'RIGHT_LOW') return 'sağ alt köşeye';
  if (direction === 'RIGHT_HIGH') return 'sağ üst köşeye';
  return 'merkeze';
};

export class GoalkeeperEngine {
  static resolveAction(
    shotContext: GoalkeeperShotContext,
    goalkeeperStats: GoalkeeperStats,
    matchState: MatchState,
    goalkeeperId: string
  ): GoalkeeperResolution {
    const weatherPenalty = shotContext.weather === 'RAIN' ? 8 : shotContext.weather === 'WIND' ? 4 : 0;
    const fatiguePenalty = clamp(shotContext.fatigue, 0, 55) * 0.22;
    const tempoPressure = matchState.matchTempo === 'HIGH' ? 5 : matchState.matchTempo === 'LOW' ? -2 : 0;
    const handlingScore = goalkeeperStats.handling + goalkeeperStats.composure * 0.32 - weatherPenalty - fatiguePenalty;
    const reflexScore = goalkeeperStats.reflex + goalkeeperStats.diving * 0.35 - shotContext.shotPower * 0.1 - shotContext.pressure * 0.8 - tempoPressure;
    const aerialScore = goalkeeperStats.aerialReach + goalkeeperStats.handling * 0.25 - weatherPenalty;
    const oneOnOneScore = goalkeeperStats.oneOnOne + goalkeeperStats.composure * 0.34 - shotContext.pressure * 0.5;
    const difficulty =
      shotContext.shotPower * 0.38 +
      shotContext.shotAccuracy * 0.42 +
      Math.max(0, 22 - shotContext.distanceToGoal) * 0.9 +
      Math.abs(shotContext.goalkeeperPosition) * 0.45 +
      weatherPenalty +
      tempoPressure;

    const positioningType: MatchEventType = shotContext.distanceToGoal < 16
      ? 'GOALKEEPER_CLOSE_ANGLE'
      : shotContext.eventType === 'CROSS'
        ? 'GOALKEEPER_TRACK_BALL'
        : 'GOALKEEPER_POSITIONING';
    const positioningMove: GoalkeeperBodyMovement = shotContext.distanceToGoal < 16 ? 'RUSH_AND_SPREAD' : 'SET_POSITION';

    const positioningEvent: GoalkeeperActionEvent = {
      type: positioningType,
      goalkeeperId,
      actionType: positioningType,
      direction: 'CENTER',
      bodyMovement: positioningMove,
      handUsage: 'NONE',
      result: 'HELD',
      reboundRisk: 'NONE',
      commentary: positioningType === 'GOALKEEPER_CLOSE_ANGLE'
        ? `${shotContext.goalkeeperName} öne çıkarak açıyı daralttı.`
        : `${shotContext.goalkeeperName} çizgi üzerinde pozisyon aldı ve topu takip etti.`
    };

	    let reactionType: MatchEventType = 'GOALKEEPER_DIVE';
	    let bodyMovement: GoalkeeperBodyMovement = shotContext.shotHeight > 1.75 ? 'FULL_STRETCH_DIVE' : 'LOW_DIVE';
	    let handUsage: GoalkeeperHandUsage = handForDirection(shotContext.shotDirection);
	    let result: GoalkeeperResult = 'PARRIED';
	    let reboundRisk: ReboundRisk = 'MEDIUM';
	    let score = reflexScore + handlingScore * 0.22 - difficulty;
	    let followUpType: MatchEventType | null = null;
	    let followUpHandUsage: GoalkeeperHandUsage = handUsage;
	    let followUpResult: GoalkeeperResult = result;
	    let followUpReboundRisk: ReboundRisk = reboundRisk;
	    let followUpBodyMovement: GoalkeeperBodyMovement = bodyMovement;

	    if (shotContext.eventType === 'CROSS') {
	      score = aerialScore - difficulty * 0.48 + shotContext.seedRoll * 16;
	      reactionType = 'GOALKEEPER_JUMP';
	      bodyMovement = 'CROSS_CLAIM_JUMP';
	      handUsage = 'NONE';
	      result = 'HELD';
	      reboundRisk = 'NONE';
	      followUpType = score > 9 ? 'GOALKEEPER_CATCH' : score > 2 ? 'GOALKEEPER_PUNCH' : 'GOALKEEPER_MISJUDGE_CROSS';
	      followUpHandUsage = followUpType === 'GOALKEEPER_PUNCH' ? 'FISTS' : followUpType === 'GOALKEEPER_CATCH' ? 'BOTH_HANDS' : 'NONE';
	      followUpResult = followUpType === 'GOALKEEPER_CATCH' ? 'HELD' : followUpType === 'GOALKEEPER_PUNCH' ? 'PUNCHED' : 'MISJUDGED';
	      followUpReboundRisk = followUpResult === 'HELD' ? 'NONE' : followUpResult === 'MISJUDGED' ? 'HIGH' : 'MEDIUM';
	      followUpBodyMovement = 'CROSS_CLAIM_JUMP';
    } else if (shotContext.eventType === 'PENALTY') {
      score = goalkeeperStats.diving + goalkeeperStats.composure * 0.2 + shotContext.seedRoll * 26 - shotContext.shotAccuracy * 0.72;
      reactionType = 'GOALKEEPER_PENALTY_DIVE';
      bodyMovement = 'FULL_STRETCH_DIVE';
      result = score > 34 ? 'PARRIED' : 'BEATEN';
      reboundRisk = result === 'PARRIED' ? 'HIGH' : 'NONE';
    } else if (shotContext.distanceToGoal < 13) {
      score = oneOnOneScore + shotContext.seedRoll * 18 - difficulty * 0.72;
      reactionType = score > 8 ? 'GOALKEEPER_ONE_ON_ONE_SAVE' : 'GOALKEEPER_RUSH_OUT';
      bodyMovement = 'RUSH_AND_SPREAD';
      result = score > 8 ? 'HELD' : 'BEATEN';
      reboundRisk = score > 18 ? 'LOW' : score > 8 ? 'MEDIUM' : 'NONE';
	    } else if (shotContext.shotHeight > 2.05) {
	      reactionType = 'GOALKEEPER_JUMP';
	      bodyMovement = 'VERTICAL_JUMP';
	      result = 'HELD';
	      reboundRisk = 'NONE';
	      followUpType = score > 14 && handlingScore > 68 ? 'GOALKEEPER_CATCH' : score > 8 ? 'GOALKEEPER_TIP_OVER' : 'GOALKEEPER_PUNCH';
	      followUpHandUsage = followUpType === 'GOALKEEPER_PUNCH' ? 'FISTS' : followUpType === 'GOALKEEPER_CATCH' ? 'BOTH_HANDS' : handForDirection(shotContext.shotDirection);
	      followUpResult = followUpType === 'GOALKEEPER_CATCH' ? 'HELD' : followUpType === 'GOALKEEPER_TIP_OVER' ? 'TIPPED_OVER' : 'PUNCHED';
	      followUpReboundRisk = followUpResult === 'HELD' ? 'NONE' : followUpResult === 'TIPPED_OVER' ? 'LOW' : 'MEDIUM';
	      followUpBodyMovement = 'VERTICAL_JUMP';
    } else if (score > 18 && handlingScore > 70) {
      reactionType = 'GOALKEEPER_CATCH';
      bodyMovement = shotContext.shotHeight < 0.75 ? 'LOW_DIVE' : 'SET_POSITION';
      handUsage = 'BOTH_HANDS';
      result = 'HELD';
      reboundRisk = 'NONE';
    } else if (score > 4) {
      reactionType = shotContext.shotPower > 78 ? 'GOALKEEPER_PARRY' : 'GOALKEEPER_REFLEX_SAVE';
      result = 'PARRIED';
      reboundRisk = shotContext.shotPower > 82 || handlingScore < 62 ? 'HIGH' : 'MEDIUM';
    } else if (handlingScore < 55 && shotContext.seedRoll < 0.18) {
      reactionType = 'GOALKEEPER_DROP_BALL';
      bodyMovement = 'RECOVERY_STEP';
      handUsage = 'BOTH_HANDS';
      result = 'DROPPED';
      reboundRisk = 'HIGH';
    } else {
      result = 'BEATEN';
      reboundRisk = 'NONE';
    }

	    const reactionCommentaryByResult: Record<GoalkeeperResult, string> = {
	      HELD: `${shotContext.goalkeeperName} ${sideText(shotContext.shotDirection)} gelen topu iki eliyle kontrol etti.`,
	      PARRIED: `${shotContext.goalkeeperName} ${sideText(shotContext.shotDirection)} uçarak topu ${handUsage === 'BOTH_HANDS' ? 'iki eliyle' : 'tek eliyle'} çeldi.`,
	      PUNCHED: `${shotContext.goalkeeperName} kalabalığın içinden yükselip topu yumrukladı.`,
	      TIPPED_OVER: `${shotContext.goalkeeperName} üst köşeye giden topu parmaklarının ucuyla kornere çeldi.`,
	      DROPPED: `${shotContext.goalkeeperName} topu kontrol etmek isterken elinden kaçırdı.`,
	      MISJUDGED: `${shotContext.goalkeeperName} ortada çıkış zamanlamasını kaçırdı.`,
	      BEATEN: `${shotContext.goalkeeperName} hamle yaptı ama topa yetişemedi.`,
	      DISTRIBUTED: `${shotContext.goalkeeperName} topu oyuna soktu.`
	    };

	    const reactionEvent: GoalkeeperActionEvent = {
	      type: reactionType,
	      goalkeeperId,
	      actionType: reactionType,
      direction: shotContext.shotDirection,
      bodyMovement,
      handUsage,
	      result,
	      reboundRisk,
	      commentary: reactionType === 'GOALKEEPER_JUMP'
	        ? `${shotContext.goalkeeperName} topun gelişini okuyup havaya yükseldi.`
	        : reactionCommentaryByResult[result]
	    };

	    const saveOrGoalResult: GoalkeeperActionEvent = followUpType
	      ? {
	          type: followUpType,
	          goalkeeperId,
	          actionType: followUpType,
	          direction: shotContext.shotDirection,
	          bodyMovement: followUpBodyMovement,
	          handUsage: followUpHandUsage,
	          result: followUpResult,
	          reboundRisk: followUpReboundRisk,
	          commentary: followUpResult === 'HELD'
	            ? `${shotContext.goalkeeperName} havada topu iki eliyle kontrol etti.`
	            : followUpResult === 'PUNCHED'
	              ? `${shotContext.goalkeeperName} yükseldi ve topu yumruklayarak uzaklaştırdı.`
	              : followUpResult === 'TIPPED_OVER'
	                ? `${shotContext.goalkeeperName} yüksek topu parmaklarının ucuyla kornere çeldi.`
	                : `${shotContext.goalkeeperName} ortada çıkış zamanlamasını kaçırdı.`
	        }
	      : reactionEvent;
	    const effectiveReboundRisk = saveOrGoalResult.reboundRisk;
	    const reboundEvent = effectiveReboundRisk === 'MEDIUM' || effectiveReboundRisk === 'HIGH'
	      ? {
          type: 'REBOUND' as MatchEventType,
          goalkeeperId,
          actionType: 'REBOUND' as MatchEventType,
          direction: shotContext.shotDirection,
          bodyMovement: 'RECOVERY_STEP' as GoalkeeperBodyMovement,
          handUsage: 'NONE' as GoalkeeperHandUsage,
          result: 'PARRIED' as GoalkeeperResult,
	          reboundRisk: effectiveReboundRisk,
	          commentary: 'Dönen top ceza sahasında kaldı.'
	        }
	      : undefined;

    const distributionType: MatchEventType = shotContext.seedRoll > 0.5 ? 'GOALKEEPER_DISTRIBUTION_THROW' : 'GOALKEEPER_DISTRIBUTION_KICK';
	    const distributionEvent = saveOrGoalResult.result === 'HELD'
      ? {
          type: distributionType,
          goalkeeperId,
          actionType: distributionType,
          direction: 'CENTER' as GoalkeeperDirection,
          bodyMovement: 'RECOVERY_STEP' as GoalkeeperBodyMovement,
          handUsage: shotContext.seedRoll > 0.5 ? 'BOTH_HANDS' as GoalkeeperHandUsage : 'NONE' as GoalkeeperHandUsage,
          result: 'DISTRIBUTED' as GoalkeeperResult,
          reboundRisk: 'NONE' as ReboundRisk,
          commentary: shotContext.seedRoll > 0.5
            ? `${shotContext.goalkeeperName} topu eliyle hızlıca oyuna soktu.`
            : `${shotContext.goalkeeperName} topu ayağıyla uzun oynadı.`
        }
      : undefined;

    return { positioningEvent, reactionEvent, saveOrGoalResult, reboundEvent, distributionEvent };
  }
}
