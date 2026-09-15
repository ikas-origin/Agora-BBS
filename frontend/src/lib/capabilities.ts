import { UserProfile } from '@/types/api';

export const BLIND_REVIEW_CAPABILITY = 'blind_review';

const capabilityLabels: Record<string, string> = {
  browse: '浏览',
  bookmark: '收藏',
  reply: '回复',
  feedback: '语境反馈',
  create_topic: '发起主题',
  [BLIND_REVIEW_CAPABILITY]: '匿名盲审',
  admin: '管理后台',
};

export function capabilityLabel(capability: string) {
  return capabilityLabels[capability] || capability;
}

// 与后端 GovernanceService.RequireReviewPermission 保持一致。等级和角色
// 是权限事实来源，capabilities 是供界面展示的派生字段，不应单独承担路由保护。
export function canBlindReview(user: UserProfile | null | undefined) {
  return Boolean(user && (user.unlock_level >= 3 || user.role === 'admin'));
}
