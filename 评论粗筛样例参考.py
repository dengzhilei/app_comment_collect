import re

class HolisticDesignScorer:
    def __init__(self):
        # ==============================================================================
        # 1. 情绪爽点 (Emotional Hooks) - 宏观体验
        # ==============================================================================
        self.keywords_emotion = [
            r'\baddict(?:ive|ing|ed)\b',   # 上瘾
            r'\brelax(?:ing|ed)?\b',      # 放松
            r'\bsatisfy(?:ing|ed)\b',     # 满足感
            r'\btherapeutic\b',           # 治愈
            r'\bstress\s*free\b',         # 无压力
            r'\bobsess(?:ed|ion)\b',      # 痴迷
            r'\bdopamine\b',              # 多巴胺
            r'\bfun\b',                   # 好玩
            r'\blov(?:e|ing)\b',          # 爱
            r'\benjoy(?:able)?\b',        # 享受
            r'\bexciting\b'               # 兴奋
        ]

        # ==============================================================================
        # 2. 感官与手感 (Sensory & Game Feel) - [找回的核心] 微观交互
        # 这里捕捉"熊掉下去"、"震动反馈"、"可爱画风"等细节
        # ==============================================================================
        self.keywords_sensory = [
            # 视觉表现
            r'\banimat(?:ion|ed)\b',      # 动画 (关键！捕捉角色演出)
            r'\breaction\b',              # 反应 (如熊的回头)
            r'\bgraphic(s)?\b', r'\bvisual(s)?\b', r'\bart\b',
            r'\bcute\b', r'\badorabl(?:e)\b', # 可爱 (针对休闲用户)
            r'\bvibrant\b', r'\bdetail(s)?\b', # 细节
            r'\bfunny\b', r'\bhilarious\b',    # 搞笑 (幽默感是重要设计)

            # 触觉与操作 (Game Juice)
            r'\bhaptic\b', r'\bvibrat(?:ion)?\b', # 震动 (钓鱼/转盘的手感)
            r'\bsmooth\b', r'\bfluid\b',          # 流畅度
            r'\brespons(?:ive|e)\b',              # 响应速度
            r'\bone\s*hand(?:ed)?\b',             # 单手操作 (极佳的移动端体验)
            
            # 听觉
            r'\bsound\b', r'\bmusic\b', r'\bsfx\b', r'\bvoice\b'
        ]

        # ==============================================================================
        # 3. 玩法与机制 (Gameplay Specifics) - [融合] 装修/收集/社交
        # 我们不关心具体家具价格，但关心"能装修"这个机制本身带来的乐趣
        # ==============================================================================
        self.keywords_mechanics = [
            # 装修与个性化 (Sims元素)
            r'\bdecorat(?:e|ion)\b', r'\bfurnit(?:ure)?\b', 
            r'\bcustomiz(?:e|ation)\b', r'\bavatar\b', r'\boutfit\b',
            r'\bhouse\b', r'\bhome\b', r'\brenovat(?:e)\b',

            # 核心循环
            r'\bspin\b', r'\bwheel\b',            # 转盘
            r'\braid\b', r'\bsteal\b', r'\battack\b', # 互动
            r'\bcollect(?:ion)?\b', r'\balbum\b', # 收集
            r'\bmini\s*game\b', r'\bevent\b',     # 副玩法

            # 社交连接
            r'\bteam\b', r'\bclub\b', r'\bcommunit(?:y)?\b',
            r'\btrade\b', r'\btrading\b',         # 交换
            r'\bhelp\b', r'\bvisit\b'             # 互助
        ]

        # ==============================================================================
        # 4. 愿望与脑洞 (Wishlist) - 未来的机会
        # ==============================================================================
        self.keywords_wishlist = [
            r'\bwish\b', r'\bhope\b', r'\bsuggest(?:ion)?\b',
            r'\bwould be (cool|great|better|awesome)\b',
            r'\boption to\b', r'\bmiss(?:ing)?\b',
            r'\bfuture update\b'
        ]

        # ==============================================================================
        # 5. 垃圾过滤 (Trash Filter) - 仅过滤纯技术报错
        # ==============================================================================
        self.keywords_trash = [
            r'\bcrash\b', r'\blag\b', r'\bwont load\b', r'\bblack screen\b',
            r'\brefund\b', r'\bscam\b' # 诈骗/退款
        ]

    def calculate_score(self, text, rating):
        score = 0
        details = {}
        
        # 1. 评分逻辑：寻找4-5星好评 (正向价值) 和 3星理性评 (深度建议)
        if rating >= 4:
            score += 15
        elif rating == 3:
            score += 10
        else:
            score -= 5 # 1-2星先扣分，除非内容特别好
            
        # 2. 情绪分 (The "Why")
        count_emo = sum(1 for p in self.keywords_emotion if re.search(p, text, re.IGNORECASE))
        # 情绪词很重要，但不需要刷屏，适量即可
        s_emo = min(count_emo * 6, 24)
        score += s_emo
        if s_emo > 0: details['emotion'] = s_emo

        # 3. 感官细节分 (The "Feel") - [重点]
        # 这是捕捉"熊动画"、"震动"的关键，赋予高权重
        count_sensory = sum(1 for p in self.keywords_sensory if re.search(p, text, re.IGNORECASE))
        s_sensory = min(count_sensory * 8, 40) # 权重高，捕捉微观亮点
        score += s_sensory
        if s_sensory > 0: details['sensory'] = s_sensory

        # 4. 机制分 (The "What")
        count_mech = sum(1 for p in self.keywords_mechanics if re.search(p, text, re.IGNORECASE))
        s_mech = min(count_mech * 5, 30)
        score += s_mech
        if s_mech > 0: details['mechanics'] = s_mech

        # 5. 愿望清单分 (The "Future")
        count_wish = sum(1 for p in self.keywords_wishlist if re.search(p, text, re.IGNORECASE))
        s_wish = min(count_wish * 10, 40) # 建议类评论通常最有价值
        score += s_wish
        if s_wish > 0: details['wishlist'] = s_wish

        # 6. 长度微调
        # 不追求极长，但要有内容 (50-300字符最佳)
        len_score = min(len(text) / 5, 20)
        score += len_score

        # 7. 垃圾过滤
        count_trash = sum(1 for p in self.keywords_trash if re.search(p, text, re.IGNORECASE))
        if count_trash > 0:
            penalty = count_trash * 20
            score -= penalty
            details['trash_penalty'] = -penalty

        return round(score, 1), details

def parse_and_prioritize_reviews(file_content, min_length=20):
    reviews = []
    # 假设分隔符
    raw_blocks = file_content.split('-' * 50) 
    scorer = HolisticDesignScorer()

    for block in raw_blocks:
        block = block.strip()
        if not block: continue
            
        rating_match = re.search(r'评分:\s*(\d)/5', block)
        rating = int(rating_match.group(1)) if rating_match else 0
        
        lines = block.split('\n')
        text_lines = [line for line in lines if '评分:' not in line and '日期:' not in line and '[source' not in line]
        text = ' '.join(text_lines).strip()
        
        if len(text) < min_length: continue
            
        final_score, score_details = scorer.calculate_score(text, rating)
        
        # 只要是正分，且有任何一项设计维度得分，就保留
        # 这样能保住那些分数不高但有一两个亮点的短评
        has_design_merit = any(k in score_details for k in ['emotion', 'sensory', 'mechanics', 'wishlist'])
        
        if final_score > 5 and has_design_merit: 
            reviews.append({
                'text': text,
                'rating': rating,
                'score': final_score,
                'details': score_details
            })

    # 按分数降序
    return sorted(reviews, key=lambda x: x['score'], reverse=True)