import { USER_ROLES } from '../constants/roles.js'

export async function populateLabourCategories(user) {
  if (!user) return user
  if (user.role === USER_ROLES.LABOUR && user.labourProfile?.categoryIds?.length) {
    await user.populate({
      path: 'labourProfile.categoryIds',
      select: 'name slug subtitle group isActive',
      populate: { path: 'group', select: 'name slug kind sortOrder' },
    })
  }
  if (user.role === USER_ROLES.CONTRACTOR && user.contractorProfile?.categoryIds?.length) {
    await user.populate({
      path: 'contractorProfile.categoryIds',
      select: 'name slug subtitle group isActive',
      populate: { path: 'group', select: 'name slug kind sortOrder' },
    })
  }
  return user
}
