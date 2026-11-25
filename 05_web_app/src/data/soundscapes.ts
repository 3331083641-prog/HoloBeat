import type { BeatPresetId, ScaleId } from '../types/holo';

export interface CuratedSoundscape {
  id: string;
  title: string;
  subtitle: string;
  timeTag: string;
  storyZh: string;
  arrangementReasonZh: string;
  visualMotifZh: string;
  accentColor: string;
  cardIds: [string, string, string, string];
  beatPreset: BeatPresetId;
  bpm: number;
  scale: ScaleId;
}

/**
 * 3 Curated Street Soundscape Entrances (策展声景入口)
 * Note: Framed explicitly as creative soundscapes inspired by urban street imagery
 * (受市井声景启发的声音转译创作场景), never misstated as documentary field recordings.
 */
export const CURATED_SOUNDSCAPES: CuratedSoundscape[] = [
  {
    id: 'morning-alley',
    title: '清晨弄堂',
    subtitle: '竹板敲醒石板路，车铃穿过早点摊',
    timeTag: '07:30 · 早市律动',
    storyZh:
      '清晨的窄巷先响起竹板清脆的二拍子，紧接着二八大杠车铃擦身而过，豆浆摊铜勺轻碰碗沿，街口铁板刚升起第一缕暖汽。',
    arrangementReasonZh:
      '弄堂竹板作稳重底鼓骨架，二八车铃点亮反拍金属切分，糖画铜勺勾勒五声轻快旋律，夜市铁板暖和弦轻托清晨烟火气。',
    visualMotifZh: '竹节双片 · 铜铃弧门 · 琥珀铜勺',
    accentColor: '#7C3AED',
    cardIds: ['card-01', 'card-05', 'card-10', 'card-13'],
    beatPreset: 'MARKET',
    bpm: 116,
    scale: 'PENTA_C',
  },
  {
    id: 'afternoon-arcade',
    title: '午后街机',
    subtitle: '硬币落槽的一瞬，整排屏幕同时亮起',
    timeTag: '15:20 · 像素脉冲',
    storyZh:
      '放学后的街角游戏厅里，微动大拍键与汽水拉环清脆交错，一枚黄铜币滑入投币口触发五度上行琶音，老霓虹灯箱微微低鸣。',
    arrangementReasonZh:
      '街机拍键提供弹性四拍底鼓，冰镇汽水拉环充当干脆高频踩镲，像素街机投币担任主角旋律，港风霓虹电流铺出合成波氛围。',
    visualMotifZh: '像素拍键 · 投币方孔 · 磁带霓虹',
    accentColor: '#00D4AA',
    cardIds: ['card-02', 'card-06', 'card-09', 'card-15'],
    beatPreset: 'ARCADE',
    bpm: 124,
    scale: 'MINOR_C',
  },
  {
    id: 'night-market',
    title: '夜市灯火',
    subtitle: '铁板滋啦翻炒热浪，晚风吹过灯笼檐角',
    timeTag: '21:10 · 烟火高潮',
    storyZh:
      '入夜后的街巷热闹升温：远处舞狮鼓点低频震动，茶棚麻将声清脆接拍，赛博古筝拨出东方夜色旋律，铁板滋啦伴随暖风铺满整条长街。',
    arrangementReasonZh:
      '舞狮大鼓稳住强劲下拍重心，麻将碰杠切出凌厉东方军鼓，赛博古筝奏出 A/B 问答拨弦，夜市铁板与街巷回声营造开阔夜色。',
    visualMotifZh: '铁板双铲 · 骨玉麻将 · 霓虹古筝',
    accentColor: '#FF5C2B',
    cardIds: ['card-04', 'card-07', 'card-11', 'card-13'],
    beatPreset: 'NIGHT',
    bpm: 126,
    scale: 'MINOR_C',
  },
];
