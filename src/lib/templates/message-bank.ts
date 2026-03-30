import type { ActivityType, TimeContext, TriggerType } from "../../types";

export interface MessageTemplate {
  id: string;
  activity: ActivityType;
  timeContext: TimeContext | "any";
  triggerContext: TriggerType | "any";
  template: string;
}

export const MESSAGE_BANK: MessageTemplate[] = [
  // ===== happy (웃는) =====
  { id: "happy-1", activity: "happy", timeContext: "any", triggerContext: "timer", template: "{{petName}}이가 활짝 웃고 있어! {{name}}도 웃어봐~" },
  { id: "happy-2", activity: "happy", timeContext: "morning", triggerContext: "any", template: "좋은 아침! {{petName}}이가 {{name}} 보고 웃고 있어!" },
  { id: "happy-3", activity: "happy", timeContext: "any", triggerContext: "browse-duration", template: "{{petName}}이가 웃으면서 {{name}} 기다리고 있어~ 잠깐 쉬자!" },
  { id: "happy-4", activity: "happy", timeContext: "any", triggerContext: "any", template: "{{petName}}이 미소 보고 힘내! {{name}} 오늘도 파이팅!" },
  { id: "happy-5", activity: "happy", timeContext: "evening", triggerContext: "any", template: "{{petName}}이가 {{name}} 보고 반가워하고 있어~" },

  // ===== eating (먹는) =====
  { id: "eat-1", activity: "eating", timeContext: "afternoon", triggerContext: "time-of-day", template: "점심 먹었어? {{petName}}은 벌써 먹고 있어!" },
  { id: "eat-2", activity: "eating", timeContext: "evening", triggerContext: "time-of-day", template: "저녁 챙겨 먹었어? {{petName}}은 벌써 먹고 있어!" },
  { id: "eat-3", activity: "eating", timeContext: "any", triggerContext: "any", template: "{{petName}}이가 맛있는 거 먹고 있대~ {{name}}도 간식 하나 어때?" },
  { id: "eat-4", activity: "eating", timeContext: "morning", triggerContext: "any", template: "아침 챙겨 먹었어? {{petName}}은 벌써 밥 먹었어!" },
  { id: "eat-5", activity: "eating", timeContext: "any", triggerContext: "browse-duration", template: "{{petName}}이가 냠냠 중~ {{name}}도 뭐 좀 먹으면서 쉬자!" },

  // ===== running (뛰는) =====
  { id: "run-1", activity: "running", timeContext: "any", triggerContext: "timer", template: "{{name}}, 스트레칭 한번 하자! {{petName}}도 뛰고 있어!" },
  { id: "run-2", activity: "running", timeContext: "morning", triggerContext: "any", template: "좋은 아침! {{petName}}이 신나게 뛰어다니고 있어!" },
  { id: "run-3", activity: "running", timeContext: "any", triggerContext: "any", template: "{{petName}}이가 신나서 달리고 있어~ 에너지 충전!" },
  { id: "run-4", activity: "running", timeContext: "any", triggerContext: "browse-duration", template: "{{petName}}이처럼 몸 좀 움직여볼까! 자리에서 일어나봐~" },
  { id: "run-5", activity: "running", timeContext: "afternoon", triggerContext: "any", template: "{{petName}}이가 놀자고 해! 같이 움직이자~" },

  // ===== sleeping (자는) =====
  { id: "sleep-1", activity: "sleeping", timeContext: "any", triggerContext: "browse-duration", template: "{{name}}, 눈 좀 쉬자~ {{petName}}도 자고 있어" },
  { id: "sleep-2", activity: "sleeping", timeContext: "any", triggerContext: "browse-duration", template: "{{name}}아, 잠깐 쉬어가자! {{petName}}처럼~" },
  { id: "sleep-3", activity: "sleeping", timeContext: "night", triggerContext: "any", template: "벌써 이 시간이야... {{petName}}이랑 같이 자자 zzZ" },
  { id: "sleep-4", activity: "sleeping", timeContext: "any", triggerContext: "timer", template: "{{petName}}도 꿈나라 갔어~ {{name}}도 잠깐 눈 감아봐" },
  { id: "sleep-5", activity: "sleeping", timeContext: "evening", triggerContext: "any", template: "{{petName}}이처럼 편하게 하루 마무리하자~" },

  // ===== sad (슬픔) =====
  { id: "sad-1", activity: "sad", timeContext: "any", triggerContext: "browse-duration", template: "{{petName}}이가 {{name}} 보고 싶대~ 잠깐 쉬고 같이 놀아줘!" },
  { id: "sad-2", activity: "sad", timeContext: "any", triggerContext: "timer", template: "{{petName}}이가 심심한가봐... {{name}} 잠깐 놀아줄래?" },
  { id: "sad-3", activity: "sad", timeContext: "any", triggerContext: "any", template: "{{petName}}이가 {{name}} 없으니까 우울해~ 빨리 돌아와!" },
  { id: "sad-4", activity: "sad", timeContext: "night", triggerContext: "any", template: "{{petName}}이가 {{name}} 기다리다 지쳤나봐... 오늘은 그만하자!" },
  { id: "sad-5", activity: "sad", timeContext: "evening", triggerContext: "any", template: "{{petName}}이가 슬퍼보여~ {{name}}이 안아주면 좋겠대!" },

  // ===== angry (화남) =====
  { id: "angry-1", activity: "angry", timeContext: "any", triggerContext: "browse-duration", template: "{{petName}}이가 화났어! 왜 이렇게 오래 화면만 봐!" },
  { id: "angry-2", activity: "angry", timeContext: "any", triggerContext: "timer", template: "{{petName}}이가 삐졌어~ {{name}} 빨리 와서 놀아줘!" },
  { id: "angry-3", activity: "angry", timeContext: "night", triggerContext: "any", template: "{{petName}}이가 으르렁! 이 시간에 아직도 안 자?" },
  { id: "angry-4", activity: "angry", timeContext: "any", triggerContext: "any", template: "{{petName}}이가 뚱해~ {{name}} 관심 좀 줘!" },
  { id: "angry-5", activity: "angry", timeContext: "afternoon", triggerContext: "any", template: "{{petName}}이 밥 안 줬지? 화났어!" },
];
