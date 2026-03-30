import type { ActivityType, TimeContext, TriggerType } from "../../types";

export interface MessageTemplate {
  id: string;
  activity: ActivityType;
  timeContext: TimeContext | "any";
  triggerContext: TriggerType | "any";
  template: string;
}

export const MESSAGE_BANK: MessageTemplate[] = [
  // ===== sleeping =====
  {
    id: "sleep-bd-1",
    activity: "sleeping",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{name}}, 눈 좀 쉬자~ {{petName}}도 자고 있어",
  },
  {
    id: "sleep-bd-2",
    activity: "sleeping",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{name}}아, 잠깐 쉬어가자! {{petName}}처럼~",
  },
  {
    id: "sleep-night-1",
    activity: "sleeping",
    timeContext: "night",
    triggerContext: "any",
    template: "벌써 이 시간이야... {{petName}}이랑 같이 자자 zzZ",
  },
  {
    id: "sleep-timer-1",
    activity: "sleeping",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}도 꿈나라 갔어~ {{name}}도 잠깐 눈 감아봐",
  },

  // ===== eating =====
  {
    id: "eat-lunch-1",
    activity: "eating",
    timeContext: "afternoon",
    triggerContext: "time-of-day",
    template: "점심 먹었어? {{petName}}은 벌써 먹고 있어!",
  },
  {
    id: "eat-evening-1",
    activity: "eating",
    timeContext: "evening",
    triggerContext: "time-of-day",
    template: "저녁 챙겨 먹었어? {{petName}}은 벌써 먹고 있어!",
  },
  {
    id: "eat-any-1",
    activity: "eating",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 맛있는 거 먹고 있대~ {{name}}도 간식 하나 어때?",
  },

  // ===== running =====
  {
    id: "run-timer-1",
    activity: "running",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{name}}, 스트레칭 한번 하자! {{petName}}도 뛰고 있어!",
  },
  {
    id: "run-morning-1",
    activity: "running",
    timeContext: "morning",
    triggerContext: "any",
    template: "좋은 아침! {{petName}}이 신나게 뛰어다니고 있어!",
  },
  {
    id: "run-any-1",
    activity: "running",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 신나서 달리고 있어~ {{name}}도 기분 좋은 하루!",
  },

  // ===== yawning =====
  {
    id: "yawn-lunch-1",
    activity: "yawning",
    timeContext: "afternoon",
    triggerContext: "time-of-day",
    template: "밥 먹을 시간이야! {{petName}}도 배고프대~",
  },
  {
    id: "yawn-night-1",
    activity: "yawning",
    timeContext: "night",
    triggerContext: "any",
    template: "{{petName}}이도 졸려하고 있어~ 오늘은 여기까지 하자!",
  },
  {
    id: "yawn-bd-1",
    activity: "yawning",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "하아암~ {{petName}}이도 하품 중! 잠깐 쉬어가자~",
  },

  // ===== playing =====
  {
    id: "play-any-1",
    activity: "playing",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이가 놀자고 해! {{name}}도 잠깐 쉬면서 놀자~",
  },
  {
    id: "play-any-2",
    activity: "playing",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 즐겁게 놀고 있어! {{name}}도 오늘 수고했어!",
  },

  // ===== sitting =====
  {
    id: "sit-any-1",
    activity: "sitting",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 착하게 앉아서 {{name}} 기다리고 있어!",
  },
  {
    id: "sit-any-2",
    activity: "sitting",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이가 옆에 앉아있어~ 같이 힘내자!",
  },

  // ===== lying =====
  {
    id: "lie-bd-1",
    activity: "lying",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{petName}}이도 편하게 누워있어~ {{name}}도 좀 쉬어!",
  },
  {
    id: "lie-any-1",
    activity: "lying",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 편안하게 쉬고 있대~ 오늘도 좋은 하루!",
  },

  // ===== standing =====
  {
    id: "stand-morning-1",
    activity: "standing",
    timeContext: "morning",
    triggerContext: "any",
    template: "{{petName}}이가 씩씩하게 서있어! {{name}}도 파이팅!",
  },
  {
    id: "stand-any-1",
    activity: "standing",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 멋지게 서있어~ {{name}}도 멋져!",
  },

  // ===== head-tilting =====
  {
    id: "tilt-bd-1",
    activity: "head-tilting",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{petName}}이가 갸우뚱~ 왜 이렇게 오래 화면 보고 있어?",
  },
  {
    id: "tilt-any-1",
    activity: "head-tilting",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 {{name}} 뭐하나 궁금한가봐~",
  },
  {
    id: "tilt-any-2",
    activity: "head-tilting",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이가 고개 갸웃! {{name}} 잘하고 있는 거 맞지?",
  },

  // ===== stretching =====
  {
    id: "stretch-morning-1",
    activity: "stretching",
    timeContext: "morning",
    triggerContext: "any",
    template: "좋은 아침! {{petName}}이랑 같이 기지개 켜자~",
  },
  {
    id: "stretch-bd-1",
    activity: "stretching",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{petName}}이가 기지개 켜고 있어! {{name}}도 몸 좀 풀자~",
  },
  {
    id: "stretch-any-1",
    activity: "stretching",
    timeContext: "any",
    triggerContext: "any",
    template: "쭈욱~ {{petName}}이처럼 기지개 한번 켜볼까!",
  },
];
