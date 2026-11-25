import type { TrackCategory } from '../types/holo';

export interface SoundCardArtBrief {
  cardId: string;
  artId: string;
  zhName: string;
  category: TrackCategory;
  /** 1. 声源物件 */
  sourceObject: string;
  /** 2. 具体生活情境 */
  lifeScene: string;
  /** 3. 发声方式 */
  soundingAction: string;
  /** 4. 独特轮廓 */
  silhouette: string;
  /** 5. 声音性格（合成转译特征） */
  sonicCharacter: string;
  /** 6. 对应运动语法 */
  motionMapping: string;
  /** 7. 推荐节奏用途 */
  rhythmRole: string;
  /** 是否属于首批 4 张视觉标杆 */
  isBenchmark?: boolean;
}

/**
 * 16 张市井声卡「声源物件 → 发声特征 → 合成方式 → 角色轮廓 → 运动语法」完整设计证据链。
 * 所有音频均明确界定为“受市井声景启发的程序化声音转译”，不伪称为田野实录或非遗原声。
 */
export const SOUND_CARD_ART_BRIEFS: SoundCardArtBrief[] = [
  {
    cardId: 'card-01',
    artId: 'bamboo-cat',
    zhName: '弄堂竹板梆子',
    category: 'BEAT',
    sourceObject: '成对竹板、清晰竹节与红绳结',
    lifeScene: '清晨石板弄堂里打响节拍的双片竹板声',
    soundingAction: '双片竹板错落相击，干脆利落的木质瞬态叠合低频鼓心',
    silhouette: '双片微张的细长竹节矩形 + 顶部红绳结，小巧表情融入上竹节',
    sonicCharacter: '厚实底鼓脉冲叠加双木击瞬态，干脆有弹性',
    motionMapping: '紫色圆角方印 · 短促下压与扎实落地回弹',
    rhythmRole: '第 1 / 3 拍核心律动锚点（Kick + Wood Attack）',
    isBenchmark: true,
  },
  {
    cardId: 'card-02',
    artId: 'arcade-bot',
    zhName: '老式街机拍键',
    category: 'BEAT',
    sourceObject: '凹面街机大拍键、微动开关柱与街机框体',
    lifeScene: '放学后街角街机厅连续拍击微动大按键',
    soundingAction: '按压回弹瞬间产生的低频腔体震动与高频咔哒开关声',
    silhouette: '宽圆凹顶拍键帽 + 阶梯底座，表情嵌于键面微光处',
    sonicCharacter: '干脆紧凑的电子四拍底鼓加高频微动瞬态',
    motionMapping: '紫色圆角方印 · 垂直弹簧压下与干脆归位',
    rhythmRole: '124–130 BPM 电子舞曲稳拍底鼓',
  },
  {
    cardId: 'card-03',
    artId: 'chestnut-pop',
    zhName: '糖炒栗子爆壳',
    category: 'BEAT',
    sourceObject: '裂口油亮糖炒栗子与深铁炒锅边',
    lifeScene: '冬夜街口黑砂翻炒铁锅里骤然崩开的爆壳噼啪',
    soundingAction: '外壳受热裂开瞬间的酥脆爆裂脉冲叠合闷热锅底共振',
    silhouette: '水滴尖顶栗子廓形 + 锯齿状金色裂口与焦糖底座',
    sonicCharacter: '暖感低频鼓点配短促高通爆裂噪声',
    motionMapping: '紫色圆角方印 · 爆发式微弹跳与暖感落震',
    rhythmRole: '慢拍 Lo-Fi 或暖色调摇摆底鼓',
  },
  {
    cardId: 'card-04',
    artId: 'lion-drum',
    zhName: '舞狮咚咚大鼓',
    category: 'BEAT',
    sourceObject: '朱红铜钉大堂鼓与双木鼓槌',
    lifeScene: '节庆街口开场时震动胸腔的醒狮大鼓',
    soundingAction: '双槌重击鼓心与铜钉鼓边，带出饱满低频共振余尾',
    silhouette: '厚实扁圆朱红鼓身 + 环绕铜钉 + 交错鼓槌',
    sonicCharacter: '深沉亚低音膜鸣配清脆鼓边木击',
    motionMapping: '紫色圆角方印 · 强烈下压与大幅震动余波',
    rhythmRole: '高能强拍重心与高潮段落推进鼓',
  },
  {
    cardId: 'card-05',
    artId: 'street-bell',
    zhName: '二八大杠车铃',
    category: 'PERC',
    sourceObject: '复古自行车半球形黄铜铃罩、拇指拨杆与车把夹具',
    lifeScene: '胡同口骑车穿行时拇指连拨的清脆双音车铃',
    soundingAction: '拇指拨动弹性拨杆敲击半球黄铜罩，激起明亮双谐波金属铃鸣',
    silhouette: '半球铜铃罩主体 + 侧伸拨杆臂 + 底部弧形车把夹具',
    sonicCharacter: '双谐波 FM 金属铃音，明亮清脆穿透力强',
    motionMapping: '橙色双圆环 · 清晰接触点与短寿命高频双波纹',
    rhythmRole: '反拍亮点切分与第 2 / 4 拍清脆打击乐',
    isBenchmark: true,
  },
  {
    cardId: 'card-06',
    artId: 'soda-frog',
    zhName: '冰镇汽水拉环',
    category: 'PERC',
    sourceObject: '金属易拉罐顶盖、撬起拉环与上升碳酸气泡',
    lifeScene: '夏夜小卖部冰柜取出汽水“咔哧”拉开瞬间的气泡嘶响',
    soundingAction: '金属扣断裂清响紧接高频碳酸嘶声短衰减',
    silhouette: '竖圆柱罐身 + 顶部翘起拉环头饰 + 三枚气泡点缀',
    sonicCharacter: '干脆高频白噪短衰减，天然清爽踩镲质感',
    motionMapping: '橙色双圆环 · 轻快短弧与气泡散射',
    rhythmRole: '十六分音符高频踩镲（Hi-Hat）推进',
  },
  {
    cardId: 'card-07',
    artId: 'mahjong-fox',
    zhName: '麻将碰杠脆碰',
    category: 'PERC',
    sourceObject: '双色玉背红中麻将牌块与落桌瞬态',
    lifeScene: '茶馆午后竹席桌上两枚麻将牌干脆利落相碰的骨玉双响',
    soundingAction: '两枚厚牌边角清脆互磕产生双连带通谐振瞬态',
    silhouette: '立体双层麻将牌块（翡翠背 + 奶油面）微倾叠撞',
    sonicCharacter: '双连骨玉带通木击，东方辨识度极高的脆响军鼓',
    motionMapping: '橙色双圆环 · 干脆利落的双向撞击火花',
    rhythmRole: '第 5 / 13 步东方特色军鼓替代音色',
  },
  {
    cardId: 'card-08',
    artId: 'street-rattle',
    zhName: '货郎拨浪鼓',
    category: 'PERC',
    sourceObject: '红框纸面小圆鼓、细木柄与两侧悬绳敲珠',
    lifeScene: '巷尾货郎轻摇手柄时两颗悬珠左右交替敲打鼓面',
    soundingAction: '双珠以固定间隔交替敲击薄鼓皮形成“咚哒”连击',
    silhouette: '圆盘鼓身 + 居中竖木柄 + 左右对称飞扬双绳珠',
    sonicCharacter: '交错双木腔谐振连击，顽皮跳跃',
    motionMapping: '橙色双圆环 · 左右交替摆动双环',
    rhythmRole: '反拍加花与小节尾段过门（Fill）',
  },
  {
    cardId: 'card-09',
    artId: 'lucky-coin',
    zhName: '像素街机投币',
    category: 'MELODY',
    sourceObject: '圆形黄铜街机币、方形中心孔与薄荷色小型投币槽',
    lifeScene: '街机投币口吞下硬币瞬间响起的上行五度像素提示音',
    soundingAction: '硬币落入金属导轨触发脉冲波五度双音上行琶音',
    silhouette: '大圆硬币主体 + 竖直薄荷投币槽基座 + 像素星光',
    sonicCharacter: '调式锁定脉冲波上行五度芯片旋律，清亮抓耳',
    motionMapping: '薄荷菱星 · 连贯抛物线随音高起伏跃动',
    rhythmRole: '核心主旋律 Hook 与 A/B 乐句问答主角',
    isBenchmark: true,
  },
  {
    cardId: 'card-10',
    artId: 'sugar-spoon',
    zhName: '糖画铜勺叮当',
    category: 'MELODY',
    sourceObject: '长柄黄铜浇糖小勺与倾泻拉出的琥珀糖丝漩涡',
    lifeScene: '老街糖画摊前铜勺轻敲铁锅边后在石板上勾勒琥珀糖丝',
    soundingAction: '铜勺轻点清响配合清透 FM 玻璃钟琴颗粒音符',
    silhouette: '倾斜长柄铜勺主体 + 下方流动琥珀糖丝龙纹曲线',
    sonicCharacter: '调式锁定晶莹玻璃钟琴音色，柔和甜亮',
    motionMapping: '薄荷菱星 · 流畅拉丝般的圆润音高弧线',
    rhythmRole: '细腻分解和弦与柔和副旋律点缀',
  },
  {
    cardId: 'card-11',
    artId: 'cyber-zither',
    zhName: '赛博古筝拨弦',
    category: 'MELODY',
    sourceObject: '斜置琴身、发光琴弦与三枚几何筝码',
    lifeScene: '夜色天台与霓虹街景交汇的现代电声拨弦共鸣',
    soundingAction: '手指拨弦激发清晰起音与八度高亮装饰泛音',
    silhouette: '修长流线梯形琴身 + 平行彩弦 + 三角筝码',
    sonicCharacter: '调式锁定清亮三角波拨弦叠八度泛音，张力十足',
    motionMapping: '薄荷菱星 · 高弧跃动配弦波余颤',
    rhythmRole: '东方赛博感主旋律与高潮段领奏',
  },
  {
    cardId: 'card-12',
    artId: 'ferris-box',
    zhName: '摩天轮八音盒',
    category: 'MELODY',
    sourceObject: '圆形摩天轮轮辐、彩灯座舱与发条八音盒底座',
    lifeScene: '游乐场夜色中缓缓旋转的摩天轮配清澈钢片八音盒旋律',
    soundingAction: '发条拨片轻弹音梳发出清澈纯净的双谐波钢片钟音',
    silhouette: '圆环双圈轮辐 + 8 枚彩灯座舱 + 底座发条盒',
    sonicCharacter: '调式锁定空灵双谐波钢片琴八音盒，治愈悠长',
    motionMapping: '薄荷菱星 · 轻盈高抛星光尾迹',
    rhythmRole: '抒情慢拍主旋律与空灵高音点缀',
  },
  {
    cardId: 'card-13',
    artId: 'night-sizzle',
    zhName: '夜市铁板滋啦',
    category: 'VIBE',
    sourceObject: '深炭色凸边大铁板、橙色炉体、双小铁铲与三条升腾蒸汽',
    lifeScene: '夜市大排档炽热铁板翻炒滋响与暖光人潮氛围',
    soundingAction: '带通粉红噪声模拟铁板热滋声，叠加温暖模拟合成和弦',
    silhouette: '宽平深色铁板顶面 + 橙色炉体表情 + 双侧小铲臂 + 三道蒸汽',
    sonicCharacter: '粉红噪热滋纹理配宽厚低通模拟和弦铺底',
    motionMapping: '柠檬黄云波 · 缓慢升腾扩散与长尾辉光',
    rhythmRole: '每小节第 1 / 3 拍和声骨架与烟火铺底',
    isBenchmark: true,
  },
  {
    cardId: 'card-14',
    artId: 'rain-cloud',
    zhName: '梅雨铁皮雨棚',
    category: 'VIBE',
    sourceObject: '波浪折纹铁皮雨棚、垂挂雨滴与软云灯影',
    lifeScene: '江南老巷梅雨午后雨滴轻敲波浪铁皮棚的绵密白噪与暖电钢',
    soundingAction: '滤波细密雨点声伴随柔和三角波电钢三和弦',
    silhouette: '斜坡波浪雨棚檐 + 下垂薄荷雨滴 + 顶部轻云',
    sonicCharacter: '舒缓雨声纹理叠柔和电钢和声，松弛治愈',
    motionMapping: '柠檬黄云波 · 柔和垂落涟漪与慢速呼吸波带',
    rhythmRole: '茶馆慢拍、雨巷氛围和声铺底',
  },
  {
    cardId: 'card-15',
    artId: 'neon-tape',
    zhName: '港风霓虹电流',
    category: 'VIBE',
    sourceObject: '复古透明卡带外壳、双转动带轮与霓虹灯管边框',
    lifeScene: '九十年代街角音像店亮起霓虹灯箱时的模拟磁带微颤声',
    soundingAction: '微失谐厚锯齿合成和弦经低通动态扫频输出宽广氛围',
    silhouette: '方正磁带本体 + 双色齿轮带孔 + 霓虹描边框',
    sonicCharacter: '宽广失谐模拟合成器铺底，复古霓虹质感',
    motionMapping: '柠檬黄云波 · 横向流光波带与柔缓长尾',
    rhythmRole: '街机与夜市主题的合成波氛围声床',
  },
  {
    cardId: 'card-16',
    artId: 'cicada-moon',
    zhName: '晚风胡同蝉鸣',
    category: 'VIBE',
    sourceObject: '半透明脉纹蝉翼、圆月剪影与老巷屋檐晚风',
    lifeScene: '盛夏胡同傍晚树梢蝉声与微风拂过檐角的清凉夏夜',
    soundingAction: '闪烁高音泛音钟声叠加高频粉红风噪与柔和双音铺底',
    silhouette: '对称舒展双蝉翼 + 金色节腹 + 弦月背景',
    sonicCharacter: '空灵闪烁泛音钟声与轻柔空气铺底，收尾通透',
    motionMapping: '柠檬黄云波 · 轻盈翼振光圈与漫长余辉',
    rhythmRole: '夏夜主题空灵铺底与全曲收尾尾韵',
  },
];

export function getArtBriefByCardId(cardId: string): SoundCardArtBrief {
  return SOUND_CARD_ART_BRIEFS.find((b) => b.cardId === cardId) ?? SOUND_CARD_ART_BRIEFS[0];
}
