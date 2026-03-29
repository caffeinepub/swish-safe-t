import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type SubmitResult = {
    __kind__: "missingAnswers";
    missingAnswers: Array<string>;
} | {
    __kind__: "success";
    success: null;
};
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
export interface UserRecord {
    principal: Principal;
    name: string;
    role: AppRole;
    enabled: boolean;
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
    approveReport(reportId: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    bootstrapAdmin(name: string, setupCode: string): Promise<string>;
    createReport(clientId: string, siteName: string, assignedAuditor: Principal): Promise<string>;
    deleteQuestion(id: string): Promise<void>;
    disableQuestion(id: string): Promise<void>;
    getAllQuestions(): Promise<Array<Question>>;
    getAllSections(): Promise<Array<Section>>;
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
    listClients(): Promise<Array<Client>>;
    listReports(): Promise<Array<Report>>;
    listUsers(): Promise<Array<UserRecord>>;
    saveAuditorAnswers(reportId: string, answers: Array<Answer>): Promise<string>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveManagerAnswers(reportId: string, answers: Array<Answer>): Promise<void>;
    saveReviewerAnswers(reportId: string, answers: Array<Answer>): Promise<string>;
    sendBackReport(reportId: string, comments: string): Promise<string>;
    submitReport(reportId: string): Promise<SubmitResult>;
    submitReview(reportId: string): Promise<void>;
}
