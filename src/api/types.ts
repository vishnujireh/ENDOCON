/** Shapes returned by the ENDOCON API (amounts are integer minor units). */

export interface User {
  id: number;
  email: string;
  role: 'participant' | 'admin';
  fullName: string;
  title: string | null;
}

export interface Profile {
  email: string;
  title: string | null;
  fullName: string;
  age: number | null;
  gender: string | null;
  designation: string | null;
  organization: string | null;
  mciStateCode: string | null;
  mciRegNo: string | null;
  membershipType: 'sgei_member' | 'non_member' | null;
  membershipNo: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pinCode: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface Category {
  code: string;
  name: string;
  description: string | null;
  kind: 'delegate' | 'accompanying';
  region: 'national' | 'international';
  requiresMembership: boolean;
  currency: string;
  prices: { periodCode: string; amountMinor: number }[];
  current: { periodCode: string; originalAmountMinor: number; chargeAmountMinor: number; fxRate: string | null };
}

export interface Workshop {
  code: string;
  name: string;
  description: string | null;
  sessionLabel: string | null;
  currency: string;
  amountMinor: number;
  capacity: number | null;
  seatsLeft: number | null;
  soldOut: boolean;
}

export interface AccommodationOption {
  code: string;
  hotelName: string;
  hotelNote: string | null;
  occupancy: 'single' | 'twin_share';
  currency: string;
  nightlyAmountMinor: number;
}

export interface Period {
  code: string;
  label: string;
  displayRange: string;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Catalogue {
  serverTime: string;
  timezone: string;
  chargeCurrency: string;
  gstRateBps: number;
  gstRatePercent: string;
  usdToInrRate: string;
  currentPeriod: { code: string; label: string; displayRange: string; endsAt: string | null };
  periods: Period[];
  categories: Category[];
  workshops: Workshop[];
  accommodation: AccommodationOption[];
  stayWindow: { start: string; end: string };
}

export interface Cart {
  conferenceCategoryCode?: string | null;
  workshopCodes: string[];
  accommodation?: { optionCode: string; checkIn: string; checkOut: string } | null;
  accompanyingPersons: { title?: string | null; fullName: string }[];
}

export interface QuoteLine {
  itemType: 'conference' | 'workshop' | 'accommodation' | 'accompanying';
  description: string;
  unitAmountMinor: number;
  quantity: number;
  amountMinor: number;
  gstMinor: number;
  totalMinor: number;
  originalCurrency: string;
  originalUnitAmountMinor: number;
  fxRate: string | null;
}

export interface Quote {
  purpose: 'registration' | 'add_on';
  currency: string;
  pricingPeriod: { code: string; label: string; displayRange: string };
  gstRateBps: number;
  lines: QuoteLine[];
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
}

export interface PaymentItem {
  itemType: string;
  description: string;
  amountMinor: number;
  gstMinor: number;
  totalMinor: number;
  quantity?: number;
  unitAmountMinor?: number;
  pricingPeriodCode?: string | null;
}

export type PaymentStatus = 'created' | 'pending' | 'success' | 'failed' | 'cancelled' | 'expired' | 'conflict' | 'refunded' | 'partially_refunded';

export interface PaymentSummary {
  id: number;
  status: PaymentStatus;
  purpose: string;
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
  currency: string;
  gatewayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  failureReason: string | null;
  invoice: { id: number; number: string } | null;
  items: PaymentItem[];
}

export interface PaymentDetail extends PaymentSummary {
  orderNumber: string | null;
  gatewayOrderId: string | null;
  method: string | null;
  refundedMinor: number;
}

export interface CheckoutSession {
  paymentId: number;
  status: PaymentStatus;
  gateway: 'razorpay' | 'fake';
  keyId: string;
  gatewayOrderId: string;
  amountMinor: number;
  currency: string;
  merchantName: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  summary: { lines: PaymentItem[]; subtotalMinor: number; gstMinor: number; totalMinor: number };
}

export interface HeldConference {
  id: number;
  categoryCode: string;
  categoryName: string;
  region: 'national' | 'international';
  pricingPeriodCode: string | null;
  source: string;
  description: string;
  amountMinor: number;
  gstMinor: number;
  totalMinor: number;
  originalCurrency: string;
  originalUnitAmountMinor: number;
  fxRate: string | null;
  createdAt: string;
}

export interface HeldWorkshop {
  id: number;
  workshopCode: string;
  name: string;
  description: string;
  amountMinor: number;
  gstMinor: number;
  totalMinor: number;
  createdAt: string;
}

export interface HeldAccommodation {
  id: number;
  optionCode: string;
  hotelName: string;
  occupancy: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  description: string;
  unitAmountMinor: number;
  amountMinor: number;
  gstMinor: number;
  totalMinor: number;
  createdAt: string;
}

export interface HeldAccompanying {
  id: number;
  title: string | null;
  fullName: string;
  categoryName: string;
  description: string;
  amountMinor: number;
  totalMinor: number;
  createdAt: string;
}

export type NextStep = 'personal' | 'conference' | 'workshops' | 'accommodation' | 'complete';

export interface RegistrationStatus {
  profile: Profile;
  order: { id: number; orderNumber: string | null; status: string; confirmedAt: string | null } | null;
  conference: HeldConference | null;
  workshops: HeldWorkshop[];
  accommodation: HeldAccommodation | null;
  accompanying: HeldAccompanying[];
  payments: PaymentSummary[];
  openPayment: PaymentSummary | null;
  paidTotalMinor: number;
  steps: {
    personal: 'complete' | 'incomplete';
    conference: 'purchased' | 'not_purchased';
    workshops: { purchased: number; remaining: number; offered: number };
    accommodation: 'purchased' | 'not_purchased';
  };
  nextStep: NextStep;
  /** Pricing period in force now, decided by SERVER time (null if outside all periods). */
  pricing: { periodCode: string | null; serverTime: string };
  /** Seats left, only for workshops that have a capacity in the catalogue. */
  workshopSeatsLeft: Record<string, number>;
}

// ---- Abstracts ----

export type AbstractCategory = 'plenary' | 'yia' | 'oral' | 'eposter' | 'video';
/** Decided by the server from the file's content. */
export type FileKind = 'document' | 'image' | 'video';

export interface AuthorInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  institution?: string | null;
}

export interface Author extends AuthorInput {
  fullName: string;
}

export interface AbstractRecord {
  id: number;
  abstractNumber: string | null;
  category: AbstractCategory;
  categoryLabel: string;
  status: AbstractStatus;
  statusLabel: string;
  /** 1 = first submission; +1 for each resubmission. */
  revision: number;
  /** Latest Reject / Duplicate comment from the Scientific Committee. */
  reviewComment: string | null;
  userId?: number;
  title: string;
  institution: string;
  department: string | null;
  correspondingAuthor: string | null;
  track: string | null;
  keywords: string[];
  body: string;
  wordCount: number;
  referencesText: string | null;
  conflictOfInterest: string | null;
  presentingAuthorAge: number | null;
  sgeiMembershipNo: string | null;
  videoUrl: string | null;
  videoObjectives: string | null;
  techniqueJustification: string | null;
  englishNarrationConfirmed: boolean;
  declarationAccepted: boolean;
  submittingAuthor: Author | null;
  presentingAuthor: Author | null;
  coAuthors: Author[];
  files: { id: number; kind: FileKind; originalName: string; mimeType: string; sizeBytes: number; uploadedAt: string }[];
  submittedAt: string | null;
  resubmittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** The submitter's account (name, email and mobile come from the account). */
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string | null;
}

export type AbstractStatus = 'submitted' | 'resubmitted' | 'accepted' | 'rejected' | 'duplicate';
export type AbstractDecision = 'accepted' | 'rejected' | 'duplicate';

export interface SubmissionWindow {
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
  /** Sent by GET /abstracts/window. */
  uploadLimits?: { maxFiles: number; maxVideos: number; maxDocumentMb: number; maxVideoMb: number };
}

/** One entry of an abstract's timeline (oldest first). `reviewer` is only sent to admins. */
export type AbstractHistoryEvent =
  | { type: 'submitted' | 'resubmitted'; revision: number; at: string }
  | { type: 'review'; revision: number; at: string; decision: AbstractDecision; comment: string | null; reviewer?: string | null };

/** Row of "My Abstracts". */
export interface MyAbstractSummary {
  id: number;
  abstractNumber: string;
  title: string;
  category: AbstractCategory;
  categoryLabel: string;
  status: AbstractStatus;
  statusLabel: string;
  revision: number;
  reviewComment: string | null;
  submittedAt: string;
  resubmittedAt: string | null;
  reviewedAt: string | null;
  canResubmit: boolean;
}

export interface MyAbstractList {
  window: SubmissionWindow;
  abstracts: MyAbstractSummary[];
}

export interface MyAbstractDetail extends AbstractRecord {
  history: AbstractHistoryEvent[];
  canResubmit: boolean;
}

export interface AbstractPreviousVersion {
  revision: number;
  submittedAt: string;
  snapshot: Record<string, unknown>;
  files: { id: number; kind: FileKind; originalName: string; sizeBytes: number }[];
}

export interface AdminAbstractDetail extends AbstractRecord {
  history: AbstractHistoryEvent[];
  previousVersions: AbstractPreviousVersion[];
}

export interface AdminAuthorAbstracts {
  author: { userId: number; name: string; email: string; phone: string | null; organization: string | null; registration: string };
  abstracts: AdminAbstractDetail[];
}

// ---- Admin ----

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  rows: T[];
}

export interface AdminRegistrationRow {
  slNo: number;
  userId: number;
  orderNumber: string | null;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  conference: string | null;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  needsAttention: boolean;
  profileComplete: boolean;
  paidTotalMinor: number;
  registeredAt: string;
  confirmedAt: string | null;
}

export interface AdminStats {
  registrations: { total: number; paid: number; pending: number };
  revenueMinor: number;
  paymentsNeedingAttention: number;
  byCategory: { code: string; name: string; count: number }[];
  workshops: { code: string; name: string; capacity: number | null; sold: number }[];
  abstractsSubmitted: number;
  abstractsNeedingReview: number;
}

export interface AdminPayment extends PaymentSummary {
  gateway: string;
  gatewayOrderId: string | null;
  method: string | null;
  refundedMinor: number;
}

export interface AdminRegistrationDetail {
  user: { id: number; email: string; status: string; registeredAt: string; lastLoginAt: string | null };
  profile: Profile | null;
  order: { id: number; orderNumber: string | null; status: string; confirmedAt: string | null } | null;
  conference: HeldConference | null;
  workshops: HeldWorkshop[];
  accommodation: HeldAccommodation | null;
  accompanying: HeldAccompanying[];
  payments: AdminPayment[];
  totals: { subtotalMinor: number; gstMinor: number; totalPaidMinor: number; refundedMinor: number };
  emails: { id: number; to_email: string; template: string; status: string; attempts: number; last_error: string | null; sent_at: string | null; created_at: string }[];
  audit: { id: number; action: string; entity_type: string; entity_id: string; before: unknown; after: unknown; created_at: string; actor_email: string | null }[];
}

export interface AdminAuthorRow {
  slNo: number;
  userId: number;
  author: string;
  email: string;
  phone: string | null;
  institution: string | null;
  abstractCount: number;
  /** Abstracts waiting for a decision (Submitted + Resubmitted). */
  needsReview: number;
  /** "Paid · ENDO-0003", "Refunded" or "Not registered". */
  registration: string;
  lastSubmittedAt: string;
}


// ---- Online abstract review (judges) ----

export type JudgeReviewStatus = 'pending' | 'completed' | 'coi';

export interface Reviewer {
  id: number;
  reviewerCode: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  counts?: { assigned: number; pending: number; completed: number; coi: number };
}

export interface ReviewCriterion {
  id: number;
  name: string;
  description: string | null;
  maxScore: number;
  displayOrder: number;
  status: 'active' | 'inactive';
}

export interface JudgeScore {
  criterionId: number;
  criterionName: string;
  maxScore: number;
  score: number;
}

export interface JudgeReview {
  state: 'draft' | 'submitted';
  coi: boolean;
  coiReason: string | null;
  comments: string | null;
  recommendedCategory: AbstractCategory | null;
  recommendedCategoryLabel: string | null;
  totalScore: number | null;
  maxTotal: number | null;
  submittedAt: string | null;
  abstractRevision?: number;
  scores: JudgeScore[];
}

export interface ReviewSummary {
  assigned: number;
  pending: number;
  completed: number;
  coi: number;
  scoredReviews: number;
  totalScore: number | null;
  averageScore: number | null;
  maxPerReview: number | null;
  progress: 'not_assigned' | 'in_review' | 'completed';
  progressLabel: string;
}

export interface AdminAssignment {
  assignmentId: number;
  reviewerId: number;
  reviewerCode: string;
  reviewerName: string;
  reviewerEmail: string;
  status: JudgeReviewStatus;
  statusLabel: string;
  active: boolean;
  assignedAt: string;
  removedAt: string | null;
  replacedBy: string | null;
  review: JudgeReview | null;
}

export interface AdminAbstractReviews {
  abstract: AbstractRecord;
  assignments: AdminAssignment[];
  summary: ReviewSummary;
}

export interface ReviewAbstractRow {
  slNo: number;
  id: number;
  abstractNumber: string;
  title: string;
  category: AbstractCategory;
  categoryLabel: string;
  track: string | null;
  decision: AbstractStatus;
  decisionLabel: string;
  submitter: string;
  presenter: string;
  institution: string;
  submittedAt: string;
  assignments: { reviewerId: number; reviewerCode: string; reviewerName: string; status: JudgeReviewStatus; statusLabel: string; score: number | null; maxScore: number | null }[];
  summary: ReviewSummary;
}

export interface ReviewerAssignmentRow {
  assignmentId: number;
  abstractId: number;
  abstractNumber: string;
  title: string;
  categoryLabel: string;
  track: string | null;
  status: JudgeReviewStatus;
  statusLabel: string;
  draftSaved: boolean;
  score: number | null;
  maxScore: number | null;
  assignedAt: string;
  submittedAt: string | null;
}
