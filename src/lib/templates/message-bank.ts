import type { ActivityType, TimeContext, TriggerType } from "../../types";

export interface MessageTemplate {
  id: string;
  activity: ActivityType;
  timeContext: TimeContext | "any";
  triggerContext: TriggerType | "any";
  template: string;
}

export const MESSAGE_BANK: MessageTemplate[] = [
  // ===== resting (자는/누운) =====
  {
    id: "rest-bd-1",
    activity: "resting",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{name}}, 눈 좀 쉬자~ {{petName}}도 자고 있어",
  },
  {
    id: "rest-bd-2",
    activity: "resting",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{name}}아, 잠깐 쉬어가자! {{petName}}처럼~",
  },
  {
    id: "rest-night-1",
    activity: "resting",
    timeContext: "night",
    triggerContext: "any",
    template: "벌써 이 시간이야... {{petName}}이랑 같이 자자 zzZ",
  },
  {
    id: "rest-timer-1",
    activity: "resting",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}도 꿈나라 갔어~ {{name}}도 잠깐 눈 감아봐",
  },
  {
    id: "rest-timer-2",
    activity: "resting",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이도 편하게 쉬고 있어~ {{name}}도 좀 쉬어!",
  },

  // ===== eating (먹는) =====
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
  {
    id: "eat-morning-1",
    activity: "eating",
    timeContext: "morning",
    triggerContext: "any",
    template: "아침 챙겨 먹었어? {{petName}}은 벌써 밥 먹었어!",
  },

  // ===== active (뛰는/노는) =====
  {
    id: "act-timer-1",
    activity: "active",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{name}}, 스트레칭 한번 하자! {{petName}}도 뛰고 있어!",
  },
  {
    id: "act-morning-1",
    activity: "active",
    timeContext: "morning",
    triggerContext: "any",
    template: "좋은 아침! {{petName}}이 신나게 뛰어다니고 있어!",
  },
  {
    id: "act-any-1",
    activity: "active",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 신나서 놀고 있어~ {{name}}도 기분 좋은 하루!",
  },
  {
    id: "act-any-2",
    activity: "active",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이가 놀자고 해! {{name}}도 잠깐 쉬면서 놀자~",
  },
  {
    id: "act-bd-1",
    activity: "active",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{petName}}이처럼 몸 좀 움직여볼까! 자리에서 일어나봐~",
  },

  // ===== alert (앉은/서있는) =====
  {
    id: "alert-any-1",
    activity: "alert",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 {{name}} 뭐하나 궁금한가봐~",
  },
  {
    id: "alert-any-2",
    activity: "alert",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이가 옆에서 지켜보고 있어~ 같이 힘내자!",
  },
  {
    id: "alert-morning-1",
    activity: "alert",
    timeContext: "morning",
    triggerContext: "any",
    template: "{{petName}}이가 씩씩하게 서있어! {{name}}도 파이팅!",
  },
  {
    id: "alert-bd-1",
    activity: "alert",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{petName}}이가 갸우뚱~ 왜 이렇게 오래 화면 보고 있어?",
  },
  {
    id: "alert-any-3",
    activity: "alert",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 착하게 앉아서 {{name}} 기다리고 있어!",
  },

  // ===== relaxing (편하게 쉬는) =====
  {
    id: "relax-bd-1",
    activity: "relaxing",
    timeContext: "any",
    triggerContext: "browse-duration",
    template: "{{petName}}이도 편하게 쉬고 있어~ {{name}}도 좀 쉬자!",
  },
  {
    id: "relax-any-1",
    activity: "relaxing",
    timeContext: "any",
    triggerContext: "any",
    template: "{{petName}}이가 느긋하게 쉬고 있대~ 오늘도 수고했어!",
  },
  {
    id: "relax-evening-1",
    activity: "relaxing",
    timeContext: "evening",
    triggerContext: "any",
    template: "{{petName}}이처럼 편하게 하루 마무리하자~",
  },
  {
    id: "relax-timer-1",
    activity: "relaxing",
    timeContext: "any",
    triggerContext: "timer",
    template: "{{petName}}이가 여유롭게 쉬고 있어~ {{name}}도 잠깐 여유 가져봐!",
  },

  // ===== yawning (하품/기지개) =====
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
  {
    id: "yawn-morning-1",
    activity: "yawning",
    timeContext: "morning",
    triggerContext: "any",
    template: "좋은 아침! {{petName}}이랑 같이 기지개 켜자~",
  },
  {
    id: "yawn-any-1",
    activity: "yawning",
    timeContext: "any",
    triggerContext: "any",
    template: "쭈욱~ {{petName}}이처럼 기지개 한번 켜볼까!",
  },
];
