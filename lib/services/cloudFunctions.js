import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/client.js";

function call(name, data) {
  const fn = httpsCallable(functions, name);
  return fn(data).then((r) => r.data);
}

export const syncVerificationStatus = () => call("syncVerificationStatus");
export const sendPhoneOtp = (phone) => call("sendPhoneOtp", { phone });
export const verifyPhoneOtp = (phone, code) => call("verifyPhoneOtp", { phone, code });
export const submitVendorApplication = (data) => call("submitVendorApplication", data);
export const moderateVendor = (vendorId, action) => call("moderateVendor", { vendorId, action });
export const setVendorCorporate = (vendorId, isCorporate) => call("setVendorCorporate", { vendorId, isCorporate });
export const generateWebhookApiKey = (vendorId) => call("generateWebhookApiKey", { vendorId });
export const approvePointsPoolTopUp = (requestId, action) => call("approvePointsPoolTopUp", { requestId, action });
export const createLoyaltyProgram = (data) => call("createLoyaltyProgram", data);
export const updateLoyaltyProgram = (programId, updates) => call("updateLoyaltyProgram", { programId, updates });
export const initiateLoyaltyGrant = (data) => call("initiateLoyaltyGrant", data);
export const confirmLoyaltyGrant = (grantId) => call("confirmLoyaltyGrant", { grantId });
export const redeemLoyaltyPoints = (data) => call("redeemLoyaltyPoints", data);
export const topUpPointsPool = (data) => call("topUpPointsPool", data);
export const adminTopUpVendorWallet = (data) => call("adminTopUpVendorWallet", data);
export const generateUserQr = () => call("generateUserQr");
export const validateUserQr = (qrValue) => call("validateUserQr", { qrValue });
export const checkInEvent = (eventId, qrValue) => call("checkInEvent", { eventId, qrValue });
export const redeemPromoAtPos = (data) => call("redeemPromoAtPos", data);
export const createKycSession = () => call("createKycSession", {});
export const reviewKyc = (userId, action, notes) => call("reviewKyc", { userId, action, notes });
export const createPromoCode = (data) => call("createPromoCode", data);
export const validatePromoCode = (data) => call("validatePromoCode", data);
export const transferP2P = (data) => call("transferP2P", data);
export const lookupUserForTransfer = (lookup) => call("lookupUserForTransfer", { lookup });
export const requestVendorWithdrawal = (data) => call("requestVendorWithdrawal", data);
export const processVendorWithdrawal = (requestId, action) => call("processVendorWithdrawal", { requestId, action });
export const corporateTopUpUser = (data) => call("corporateTopUpUser", data);
export const confirmCorporateBinding = (vendorId, otpVerified) => call("confirmCorporateBinding", { vendorId, otpVerified });
export const getAdminVendorData = () => call("getAdminVendorData");
export const getAdminKycQueue = () => call("getAdminKycQueue");
export const getAdminDashboardStats = () => call("getAdminDashboardStats");
export const getAdminUsersList = () => call("getAdminUsersList");
export const updateUserSpendingLimits = (data) => call("updateUserSpendingLimits", data);
export const claimAdminRole = () => call("claimAdminRole");
export const updateVendorProfile = (data) => call("updateVendorProfile", data);
export const spendWorkBalance = (data) => call("spendWorkBalance", data);
export const createLottery = (data) => call("createLottery", data);
export const purchaseLotteryTicket = (lotteryId) => call("purchaseLotteryTicket", { lotteryId });
export const drawLottery = (lotteryId, bonusPointsPrize) => call("drawLottery", { lotteryId, bonusPointsPrize });
export const requestPointsPoolTopUp = (data) => call("requestPointsPoolTopUp", data);

// Matrimonial
export const createOrUpdateMatrimonialProfile = (data) => call("createOrUpdateMatrimonialProfile", data);
export const submitMatrimonialPhoto = (data) => call("submitMatrimonialPhoto", data);
export const moderateMatrimonialPhoto = (queueId, action) => call("moderateMatrimonialPhoto", { queueId, action });
export const searchMatrimonialProfiles = (data) => call("searchMatrimonialProfiles", data);
export const unlockMatrimonialProfile = (profileId) => call("unlockMatrimonialProfile", { profileId });
export const sendMatrimonialInterest = (profileId, message) => call("sendMatrimonialInterest", { profileId, message });
export const respondToMatrimonialInterest = (fromUserId, action) => call("respondToMatrimonialInterest", { fromUserId, action });
export const getMyMatrimonialProfile = () => call("getMyMatrimonialProfile");
export const getMyMatrimonialInterests = () => call("getMyMatrimonialInterests");
export const adminCreditCoins = (data) => call("adminCreditCoins", data);
export const registerMatrimonialEvent = (eventId) => call("registerMatrimonialEvent", { eventId });
export const getMyMatrimonialEventRegistrations = () => call("getMyMatrimonialEventRegistrations");

// Chat
export const createEventChatGroup = (eventId) => call("createEventChatGroup", { eventId });
export const createOrGetDirectMessage = (targetUserId) => call("createOrGetDirectMessage", { targetUserId });
export const joinEventChatGroup = (groupId) => call("joinEventChatGroup", { groupId });
export const reportChatMessage = (data) => call("reportChatMessage", data);
export const reviewChatReport = (reportId, action) => call("reviewChatReport", { reportId, action });
export const getMyChatGroups = () => call("getMyChatGroups");

export async function moderateEvent(eventId, action, rejectionReason) {
  return call("moderateEvent", { eventId, action, rejectionReason });
}

export async function linkEventToAttraction(eventId, attractionId) {
  return call("linkEventToAttraction", { eventId, attractionId });
}

export async function ensureAppSettings() {
  return call("ensureAppSettings");
}
