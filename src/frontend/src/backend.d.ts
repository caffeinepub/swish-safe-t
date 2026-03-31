import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AppUserPublic {
    username: string;
    originalRole: AppRole;
    elevatedUntil?: bigint;
    role: AppRole;
    fullName: string;
    isEnabled: boolean;
}
export type SubmitResult = {
    __kind__: "missingAnswers";
    missingAnswers: Array<string>;
} | {
    __kind__: "success";
    success: null;
};
export interface TemplateBlob {
    id: string;
    createdBy: string;
    updatedAt: bigint;
    dataJson: string;
}
export interface Report {
    id: string;
    status: ReportStatus;
    clientId: string;
    reviewerAnswers: Array<Answer>;
    createdAt: bigint;
    auditorAnswers: Array<Answer>;
    managerComments: string;
    assignedAuditor: Principal;
    siteName: string;
    updatedAt: bigint;
    managerAnswers: Array<Answer>;
}
export interface AuditBlob {
    status: string;
    lastSavedAt: bigint;
    dataJson: string;
    siteId: string;
}
export interface UserRecord {
    principal: Principal;
    name: string;
    role: AppRole;
    enabled: boolean;
}
export interface AppUser {
    username: string;
    originalRole: AppRole;
    elevatedUntil?: bigint;
    role: AppRole;
    fullName: string;
    isEnabled: boolean;
    passwordHash: string;
}
export interface Answer {
    answerValue: string;
    questionId: string;
    imageId?: string;
    remarks: string;
}
export interface Question {
    id: string;
    clientId: string;
    questionLabel: string;
    order: bigint;
    questionType: QuestionType;
    enabled: boolean;
    sectionId: string;
    isImageMandatory: boolean;
    remarksEnabled: boolean;
    options: Array<string>;
}
export interface Client {
    id: string;
    name: string;
    enabled: boolean;
}
export interface Section {
    id: string;
    clientId: string;
    order: bigint;
    name: string;
    enabled: boolean;
}
export interface UserProfile {
    name: string;
}
export enum AppRole {
    manager = "manager",
    admin = "admin",
    auditor = "auditor",
    reviewer = "reviewer"
}
export enum QuestionType {
    radio = "radio",
    dropdown = "dropdown"
}
export enum ReportStatus {
    submitted = "submitted",
    completed = "completed",
    reviewed = "reviewed",
    draft = "draft",
    pending_re_review = "pending_re_review"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addOrUpdateClient(id: string | null, name: string, enabled: boolean): Promise<string>;
    addOrUpdateQuestion(input: Question): Promise<string>;
    addOrUpdateSection(id: string | null, name: string, order: bigint, clientId: string, enabled: boolean): Promise<string>;
    addOrUpdateUser(input: UserRecord): Promise<string>;
    appUserHasAdmin(): Promise<boolean>;
    approveReport(reportId: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    bootstrapAdmin(name: string, setupCode: string): Promise<string>;
    createReport(clientId: string, siteName: string, assignedAuditor: Principal): Promise<string>;
    deleteQuestion(id: string): Promise<void>;
    deleteTemplateBlob(id: string): Promise<void>;
    disableQuestion(id: string): Promise<void>;
    getAllQuestions(): Promise<Array<Question>>;
    getAllSections(): Promise<Array<Section>>;
    getAppUserPublic(username: string): Promise<AppUserPublic | null>;
    getCallerAppRole(): Promise<AppRole>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getQuestions(): Promise<Array<Question>>;
    getQuestionsByClient(clientId: string): Promise<Array<Question>>;
    getQuestionsBySection(sectionId: string): Promise<Array<Question>>;
    getRegistrationStatus(): Promise<{
        isAuditor: boolean;
        hasAdmin: boolean;
        isRegistered: boolean;
    }>;
    getReport(reportId: string): Promise<Report | null>;
    getSectionsByClient(clientId: string): Promise<Array<Section>>;
    getUser(inputPrincipal: Principal): Promise<UserRecord>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listAppUsers(): Promise<Array<AppUserPublic>>;
    listAuditBlobs(): Promise<Array<AuditBlob>>;
    listClients(): Promise<Array<Client>>;
    listReports(): Promise<Array<Report>>;
    listTemplateBlobs(): Promise<Array<TemplateBlob>>;
    listUsers(): Promise<Array<UserRecord>>;
    loadAuditBlob(siteId: string): Promise<AuditBlob | null>;
    loadTemplateBlob(id: string): Promise<TemplateBlob | null>;
    saveAuditBlob(entry: AuditBlob): Promise<void>;
    saveAuditorAnswers(reportId: string, answers: Array<Answer>): Promise<string>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveManagerAnswers(reportId: string, answers: Array<Answer>): Promise<void>;
    saveReviewerAnswers(reportId: string, answers: Array<Answer>): Promise<string>;
    saveTemplateBlob(entry: TemplateBlob): Promise<void>;
    seedAppAdmin(user: AppUser): Promise<boolean>;
    sendBackReport(reportId: string, comments: string): Promise<string>;
    submitReport(reportId: string): Promise<SubmitResult>;
    submitReview(reportId: string): Promise<void>;
    upsertAppUser(user: AppUser): Promise<void>;
    verifyAppUserCredentials(username: string, passwordHash: string): Promise<boolean>;
}
