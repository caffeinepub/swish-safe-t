import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Order "mo:core/Order";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import MixinStorage "blob-storage/Mixin";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Storage
  include MixinStorage();

  // Authorization
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // AppRole type mapping to AccessControl roles
  public type AppRole = {
    #admin;
    #manager;
    #reviewer;
    #auditor;
  };

  // Step 0: Text Serialization
  module AppRole {
    public func toText(role : AppRole) : Text {
      switch (role) {
        case (#admin) { "admin" };
        case (#manager) { "manager" };
        case (#reviewer) { "reviewer" };
        case (#auditor) { "auditor" };
      };
    };
  };

  // User Types
  public type UserRecord = {
    principal : Principal;
    name : Text;
    role : AppRole;
    enabled : Bool;
  };

  public type UserProfile = {
    name : Text;
  };

  public type Client = {
    id : Text;
    name : Text;
    enabled : Bool;
  };

  public type Section = {
    id : Text;
    clientId : Text;
    name : Text;
    order : Nat;
    enabled : Bool;
  };

  public type QuestionType = {
    #radio;
    #dropdown;
  };

  public type Question = {
    id : Text;
    sectionId : Text;
    clientId : Text;
    questionLabel : Text;
    questionType : QuestionType;
    options : [Text];
    isImageMandatory : Bool;
    remarksEnabled : Bool;
    order : Nat;
    enabled : Bool;
  };

  public type Answer = {
    questionId : Text;
    answerValue : Text;
    remarks : Text;
    imageId : ?Text;
  };

  // Report Workflow Types
  public type ReportStatus = {
    #draft;
    #submitted;
    #reviewed;
    #pending_re_review;
    #completed;
  };

  public type Report = {
    id : Text;
    clientId : Text;
    siteName : Text;
    assignedAuditor : Principal;
    status : ReportStatus;
    auditorAnswers : [Answer];
    reviewerAnswers : [Answer];
    managerAnswers : [Answer];
    managerComments : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  module Report {
    public func compareByCreated(a1 : Report, a2 : Report) : Order.Order {
      Int.compare(a1.createdAt, a2.createdAt);
    };
  };

  public type SubmitResult = {
    #success;
    #missingAnswers : [Text];
  };

  // === APP USER MANAGEMENT (username/password auth, no IC identity needed for login) ===
  public type AppUser = {
    username : Text;
    passwordHash : Text;
    fullName : Text;
    role : AppRole;
    originalRole : AppRole;
    elevatedUntil : ?Int;
    isEnabled : Bool;
  };

  // Public type without password hash for safe external access
  public type AppUserPublic = {
    username : Text;
    fullName : Text;
    role : AppRole;
    originalRole : AppRole;
    elevatedUntil : ?Int;
    isEnabled : Bool;
  };

  // Internal Storage
  let userRecords = Map.empty<Principal, UserRecord>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let clients = Map.empty<Text, Client>();
  let sections = Map.empty<Text, Section>();
  let questions = Map.empty<Text, Question>();
  let reports = Map.empty<Text, Report>();
  // Stable storage for appUsers — survives canister upgrades
  var stableAppUsers : [(Text, AppUser)] = [];
  let appUsers = Map.empty<Text, AppUser>(); // populated in postupgrade

  // The setup passphrase for claiming admin role
  let ADMIN_SETUP_CODE : Text = "SWISH-SETUP-2026";

  // Track if bootstrap has been used
  var bootstrapUsed : Bool = false;

  // Internal Structures
  type AnswerKey = {
    reportId : Text;
    questionId : Text;
  };
  func _answerKeyCompare(a1 : AnswerKey, a2 : AnswerKey) : Order.Order {
    let reportCompare = Text.compare(a1.reportId, a2.reportId);
    if (reportCompare == #equal) {
      Text.compare(a1.questionId, a2.questionId);
    } else {
      reportCompare;
    };
  };

  // Helper Functions

  // Map AppRole to AccessControl role
  func appRoleToAccessRole(appRole : AppRole) : AccessControl.UserRole {
    switch (appRole) {
      case (#admin or #manager) { #admin };
      case (#reviewer or #auditor) { #user };
    };
  };

  // Check if user has required app role (includes hierarchy)
  func hasAppRole(caller : Principal, requiredRole : AppRole) : Bool {
    // First check AccessControl permission
    let requiredAccessRole = appRoleToAccessRole(requiredRole);
    if (not AccessControl.hasPermission(accessControlState, caller, requiredAccessRole)) {
      return false;
    };

    // Check if user is enabled in our records
    switch (userRecords.get(caller)) {
      case (?user) {
        if (not user.enabled) { return false };
        // Check role hierarchy
        switch ((user.role, requiredRole)) {
          case (_, #auditor) { true }; // Everyone can do auditor tasks
          case (#reviewer or #manager or #admin, #reviewer) { true };
          case (#manager or #admin, #manager) { true };
          case (#admin, #admin) { true };
          case (_) { false };
        };
      };
      case (null) {
        // Not in our records - only allow if they're asking for auditor role
        requiredRole == #auditor;
      };
    };
  };

  func getPrincipalRole(caller : Principal) : AppRole {
    switch (userRecords.get(caller)) {
      case (?user) { user.role };
      case (null) { #auditor };
    };
  };

  func isUserEnabled(caller : Principal) : Bool {
    switch (userRecords.get(caller)) {
      case (?user) { user.enabled };
      case (null) { true };
    };
  };

  // Automatic ID Generation Helper
  var idSeed = 0;
  func generateId(prefix : Text) : Text {
    idSeed += 1;
    let timestamp = Time.now();
    prefix # timestamp.toText() # idSeed.toText();
  };

  // Find Functions
  func _findClient(id : Text, trap : Bool) : ?Client {
    let client = clients.get(id);
    if (trap and not client.isSome()) { Runtime.trap("Client not found") };
    client;
  };
  func findSection(id : Text, trap : Bool) : ?Section {
    let section = sections.get(id);
    if (trap and not section.isSome()) { Runtime.trap("Section not found") };
    section;
  };
  func findQuestion(id : Text, trap : Bool) : ?Question {
    let question = questions.get(id);
    if (trap and not question.isSome()) { Runtime.trap("Question not found") };
    question;
  };
  func findReport(id : Text, trap : Bool) : ?Report {
    let report = reports.get(id);
    if (trap and not report.isSome()) { Runtime.trap("Report not found") };
    report;
  };

  // Section Ordering
  module Section {
    public func compare(s1 : Section, s2 : Section) : Order.Order {
      Nat.compare(s1.order, s2.order);
    };
  };

  // Question Ordering
  module Question {
    public func compare(q1 : Question, q2 : Question) : Order.Order {
      Nat.compare(q1.order, q2.order);
    };
  };

  // API Functions

  // User Profile - Required by frontend
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    userProfiles.get(user);
  };

  public query ({ caller }) func getCallerAppRole() : async AppRole {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view roles");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    getPrincipalRole(caller);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    userProfiles.add(caller, profile);
  };

  // ----- CLIENT API -----
  public shared ({ caller }) func addOrUpdateClient(id : ?Text, name : Text, enabled : Bool) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can manage clients");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    let newId = switch (id) {
      case (null) { generateId("client") };
      case (?val) { val };
    };
    let client : Client = {
      id = newId;
      name;
      enabled;
    };
    clients.add(newId, client);
    newId;
  };

  public query ({ caller }) func listClients() : async [Client] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can list clients");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    clients.values().toArray();
  };

  // ----- SECTION API -----
  public shared ({ caller }) func addOrUpdateSection(id : ?Text, name : Text, order : Nat, clientId : Text, enabled : Bool) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can manage sections");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    if (name.size() == 0) { Runtime.trap("Section name cannot be empty") };
    if (clientId.size() == 0) { Runtime.trap("Client id can not be empty") };
    let cid = generateId("client");
    let inputId = switch (id) {
      case (null) {
        let newId = generateId("section");
        let section : Section = {
          id = newId;
          name;
          order;
          clientId = cid;
          enabled = true;
        };
        sections.add(newId, section);
        newId;
      };
      case (?sectionInputId) {
        switch (findSection(sectionInputId, false)) {
          case (null) { Runtime.trap("Section not found") };
          case (_) {
            let section : Section = {
              id = sectionInputId;
              name;
              order;
              clientId = cid;
              enabled;
            };
            sections.add(sectionInputId, section);
            sectionInputId;
          };
        };
      };
    };
    inputId;
  };

  public query ({ caller }) func getSectionsByClient(clientId : Text) : async [Section] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view sections");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    sections.values().toArray().filter(func(s) { s.clientId == clientId }).sort();
  };

  public query ({ caller }) func getAllSections() : async [Section] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view sections");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    sections.values().toArray();
  };

  // ----- QUESTION API -----

  // GET METHODS
  public query ({ caller }) func getQuestionsByClient(clientId : Text) : async [Question] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view questions");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    questions.values().toArray().filter(func(q) { q.clientId == clientId }).sort();
  };

  public query ({ caller }) func getQuestionsBySection(sectionId : Text) : async [Question] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view questions");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    questions.values().toArray().filter(func(q) { q.sectionId == sectionId });
  };

  public query ({ caller }) func getQuestions() : async [Question] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view questions");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    questions.values().toArray();
  };

  public query ({ caller }) func getAllQuestions() : async [Question] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view questions");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    let enabledQuestions = questions.values().toArray().filter(func(q) { q.enabled });
    let radioQuestions = enabledQuestions.filter(
      func(q) {
        q.questionType == #radio;
      }
    );
    let dropDownQuestions = enabledQuestions.filter(
      func(q) {
        q.questionType == #dropdown;
      }
    );
    dropDownQuestions.sort().concat(radioQuestions.sort());
  };

  // ADD OR UPDATE - SINGLE METHOD
  public shared ({ caller }) func addOrUpdateQuestion(input : Question) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can manage questions");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    let checkFields = switch (input.questionType) {
      case (#radio) { input.options == ["Yes", "No", "N/A"] };
      case (#dropdown) { true };
    };

    if (not checkFields or input.questionLabel.size() == 0) {
      Runtime.trap("Invalid question attributes");
    };

    let newId = switch (questions.get(input.id)) {
      case (?existing) {
        if (existing.id != input.id) { Runtime.trap("Invalid question update") };
        questions.add(input.id, input);
        input.id;
      };
      case (null) {
        let newId = generateId("question");
        let question : Question = {
          id = newId;
          sectionId = input.sectionId;
          clientId = input.clientId;
          questionLabel = input.questionLabel;
          questionType = input.questionType;
          options = input.options;
          isImageMandatory = input.isImageMandatory;
          remarksEnabled = input.remarksEnabled;
          order = input.order;
          enabled = input.enabled;
        };
        questions.add(newId, question);
        newId;
      };
    };
    newId;
  };

  public shared ({ caller }) func deleteQuestion(id : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can delete questions");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    switch (findQuestion(id, false)) {
      case (null) { Runtime.trap("Question not found") };
      case (_) { questions.remove(id) };
    };
  };

  public shared ({ caller }) func disableQuestion(id : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can disable questions");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    switch (findQuestion(id, false)) {
      case (null) { Runtime.trap("Question not found") };
      case (?question) {
        let disabledQuestion : Question = {
          id = question.id;
          sectionId = question.sectionId;
          clientId = question.clientId;
          questionLabel = question.questionLabel;
          questionType = question.questionType;
          options = question.options;
          isImageMandatory = question.isImageMandatory;
          remarksEnabled = question.remarksEnabled;
          order = question.order;
          enabled = false;
        };
        questions.add(id, disabledQuestion);
      };
    };
  };

  // ----- REPORT WORKFLOW FUNCTIONS -----

  func buildReportInternal(
    id : Text,
    clientId : Text,
    siteName : Text,
    assignedAuditor : Principal,
    status : ReportStatus
  ) : Report {
    let timestamp = Int.abs(Time.now());
    {
      id;
      clientId;
      siteName;
      assignedAuditor;
      status;
      auditorAnswers = [];
      reviewerAnswers = [];
      managerAnswers = [];
      managerComments = "";
      createdAt = timestamp;
      updatedAt = timestamp;
    };
  };

  public shared ({ caller }) func createReport(clientId : Text, siteName : Text, assignedAuditor : Principal) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can create reports");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    if (clientId.size() == 0) { Runtime.trap("Client id can not be empty") };
    if (siteName.size() == 0) { Runtime.trap("Site name cannot be empty") };
    let reportId = generateId("report");
    let report = buildReportInternal(reportId, clientId, siteName, assignedAuditor, #draft);
    reports.add(reportId, report);
    reportId;
  };

  // Auditor saves answers (draft)
  public shared ({ caller }) func saveAuditorAnswers(reportId : Text, answers : [Answer]) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save answers");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    switch (findReport(reportId, false)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (report.assignedAuditor != caller) {
          Runtime.trap("Unauthorized: Only the assigned auditor can save answers");
        };
        if (report.status != #draft) { Runtime.trap("Can only save answers in draft status") };
        let updatedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = report.status;
          auditorAnswers = answers;
          reviewerAnswers = report.reviewerAnswers;
          managerAnswers = report.managerAnswers;
          managerComments = report.managerComments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, updatedReport);
        return reportId;
      };
    };
  };

  // Auditor submits report
  public shared ({ caller }) func submitReport(reportId : Text) : async SubmitResult {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can submit reports");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    switch (reports.get(reportId)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (report.assignedAuditor != caller) {
          Runtime.trap("Unauthorized: Only the assigned auditor can submit the report");
        };
        if (report.status != #draft) { Runtime.trap("Can only submit draft report") };
        let missingAnswers = listMissingAnswers(report.auditorAnswers);
        if (missingAnswers.size() > 0) { return #missingAnswers(missingAnswers.toArray()) };
        let submittedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = #submitted;
          auditorAnswers = report.auditorAnswers;
          reviewerAnswers = report.reviewerAnswers;
          managerAnswers = report.managerAnswers;
          managerComments = report.managerComments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, submittedReport);
        #success;
      };
    };
  };

  func listMissingAnswers(answers : [Answer]) : List.List<Text> {
    let missing = List.empty<Text>();
    for (q in questions.values()) {
      if (q.enabled and questions.get(q.id).isSome()) {
        let answer = answers.find(func(a) { a.questionId == q.id });
        let answerProvided = switch (answer) {
          case (null) { false };
          case (?a) { a.answerValue.size() > 0 };
        };
        if (not answerProvided) {
          missing.add("Question [" # q.questionLabel # "] is missing an answer");
        };
      };
    };
    missing;
  };

  // Reviewer answers
  public shared ({ caller }) func saveReviewerAnswers(reportId : Text, answers : [Answer]) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save reviewer answers");
    };
    if (not hasAppRole(caller, #reviewer)) {
      Runtime.trap("Unauthorized: Reviewer or higher role required");
    };
    switch (findReport(reportId, false)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (not (report.status == #submitted or report.status == #pending_re_review)) {
          Runtime.trap("Can only save reviewer answers in submitted or pending re-review status");
        };
        let updatedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = report.status;
          auditorAnswers = report.auditorAnswers;
          reviewerAnswers = answers;
          managerAnswers = report.managerAnswers;
          managerComments = report.managerComments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, updatedReport);
      };
    };
    reportId;
  };

  // Reviewer submits review
  public shared ({ caller }) func submitReview(reportId : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can submit reviews");
    };
    if (not hasAppRole(caller, #reviewer)) {
      Runtime.trap("Unauthorized: Reviewer or higher role required");
    };
    switch (findReport(reportId, false)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (not (report.status == #submitted or report.status == #pending_re_review)) {
          Runtime.trap("Can only submit review in submitted or pending re-review status");
        };
        let updatedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = #reviewed;
          auditorAnswers = report.auditorAnswers;
          reviewerAnswers = report.reviewerAnswers;
          managerAnswers = report.managerAnswers;
          managerComments = report.managerComments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, updatedReport);
      };
    };
  };

  // Manager Answers
  public shared ({ caller }) func saveManagerAnswers(reportId : Text, answers : [Answer]) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can save manager answers");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    switch (findReport(reportId, false)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (report.status != #reviewed) { Runtime.trap("Can only save manager answers in reviewed status") };
        let updatedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = report.status;
          auditorAnswers = report.auditorAnswers;
          reviewerAnswers = report.reviewerAnswers;
          managerAnswers = answers;
          managerComments = report.managerComments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, updatedReport);
      };
    };
  };

  // Manager Approves Report
  public shared ({ caller }) func approveReport(reportId : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can approve reports");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    switch (findReport(reportId, false)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (report.status != #reviewed) { Runtime.trap("Can only approve reviewed report") };
        let completedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = #completed;
          auditorAnswers = report.auditorAnswers;
          reviewerAnswers = report.reviewerAnswers;
          managerAnswers = report.managerAnswers;
          managerComments = report.managerComments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, completedReport);
      };
    };
  };

  // Send back for re-review
  public shared ({ caller }) func sendBackReport(reportId : Text, comments : Text) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can send back reports");
    };
    if (not hasAppRole(caller, #manager)) {
      Runtime.trap("Unauthorized: Manager or Admin role required");
    };
    switch (findReport(reportId, false)) {
      case (null) { Runtime.trap("Report not found") };
      case (?report) {
        if (report.status != #reviewed) { Runtime.trap("Can only send back reviewed report for re-review") };
        let updatedReport : Report = {
          id = report.id;
          clientId = report.clientId;
          siteName = report.siteName;
          assignedAuditor = report.assignedAuditor;
          status = #pending_re_review;
          auditorAnswers = report.auditorAnswers;
          reviewerAnswers = report.reviewerAnswers;
          managerAnswers = report.managerAnswers;
          managerComments = comments;
          createdAt = report.createdAt;
          updatedAt = Time.now();
        };
        reports.add(reportId, updatedReport);
        return report.id;
      };
    };
  };

  // List Reports, Filtered
  public query ({ caller }) func listReports() : async [Report] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can list reports");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    let reportsArray = reports.values().toArray();
    let filtered = reportsArray.filter(
      func(r) {
        if (hasAppRole(caller, #reviewer)) { true } else {
          r.assignedAuditor == caller;
        };
      }
    );
    filtered.sort(Report.compareByCreated);
  };

  public query ({ caller }) func getReport(reportId : Text) : async ?Report {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
    if (not isUserEnabled(caller)) {
      Runtime.trap("Unauthorized: User account is disabled");
    };
    switch (findReport(reportId, false)) {
      case (null) { null };
      case (?report) {
        if (hasAppRole(caller, #reviewer) or report.assignedAuditor == caller) {
          ?report;
        } else {
          Runtime.trap("Unauthorized: Can only view your own assigned reports");
        };
      };
    };
  };

  // ----- ADMIN USER MANAGEMENT FUNCTIONS -----
  public query ({ caller }) func listUsers() : async [UserRecord] {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can list users");
    };
    if (not hasAppRole(caller, #admin)) {
      Runtime.trap("Unauthorized: Admin role required");
    };
    userRecords.values().toArray();
  };

  public shared ({ caller }) func addOrUpdateUser(input : UserRecord) : async Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can manage users");
    };
    if (not hasAppRole(caller, #admin)) {
      Runtime.trap("Unauthorized: Admin role required");
    };
    if (input.name.size() == 0) { Runtime.trap("User name cannot be empty") };

    let user : UserRecord = {
      input with
      role = input.role;
      enabled = input.enabled;
    };
    userRecords.add(input.principal, user);

    // Sync with AccessControl state
    let accessRole = appRoleToAccessRole(input.role);
    AccessControl.assignRole(accessControlState, caller, input.principal, accessRole);

    let roleString = switch (input.role) {
      case (#admin) { "admin" };
      case (#manager) { "manager" };
      case (#reviewer) { "reviewer" };
      case (#auditor) { "auditor" };
    };
    "User updated with role {" # roleString # "}";
  };

  public shared ({ caller }) func getUser(inputPrincipal : Principal) : async UserRecord {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can view user details");
    };
    if (not hasAppRole(caller, #admin)) {
      Runtime.trap("Unauthorized: Admin role required");
    };
    if (inputPrincipal.isAnonymous()) { Runtime.trap("No record found for anonymous user") };
    switch (userRecords.get(inputPrincipal)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        user;
      };
    };
  };

  // Returns whether the caller is a registered user and whether any admin exists
  public query ({ caller }) func getRegistrationStatus() : async { isRegistered: Bool; hasAdmin: Bool; isAuditor: Bool } {
    let existingRecord = userRecords.get(caller);
    let isRegistered = switch (existingRecord) {
      case (?_) { true };
      case (null) { false };
    };
    let isAuditor = switch (existingRecord) {
      case (?rec) { rec.role == #auditor };
      case (null) { false };
    };
    var hasAdmin = false;
    for (record in userRecords.values()) {
      if (record.role == #admin and record.enabled) { hasAdmin := true };
    };
    { isRegistered; hasAdmin; isAuditor };
  };

  // Bootstrap admin: ANY logged-in user can claim admin with the correct setup code.
  // This can only be used once to prevent abuse after initial setup.
  public shared ({ caller }) func bootstrapAdmin(name : Text, setupCode : Text) : async Text {
    if (caller.isAnonymous()) { Runtime.trap("Cannot bootstrap with anonymous identity") };
    if (bootstrapUsed) { Runtime.trap("Bootstrap has already been used") };
    if (setupCode != ADMIN_SETUP_CODE) { Runtime.trap("Invalid setup code") };

    let user : UserRecord = {
      principal = caller;
      name = name;
      role = #admin;
      enabled = true;
    };
    userRecords.add(caller, user);
    userProfiles.add(caller, { name = name });

    // Directly update AccessControl state -- bypasses admin-only guard intentionally
    // because this is the bootstrap path for the very first admin
    accessControlState.userRoles.add(caller, #admin);
    accessControlState.adminAssigned := true;

    bootstrapUsed := true;

    "Bootstrap successful: you are now admin";
  };

  // === APP USER API ===

  // Get user's public profile — no IC auth required (credentials verified separately)
  public query func getAppUserPublic(username : Text) : async ?AppUserPublic {
    switch (appUsers.get(username.toLower())) {
      case (null) { null };
      case (?user) {
        ?{
          username = user.username;
          fullName = user.fullName;
          role = user.role;
          originalRole = user.originalRole;
          elevatedUntil = user.elevatedUntil;
          isEnabled = user.isEnabled;
        };
      };
    };
  };

  // Verify credentials — open to all callers, no IC auth needed
  public shared func verifyAppUserCredentials(username : Text, passwordHash : Text) : async Bool {
    switch (appUsers.get(username.toLower())) {
      case (null) { false };
      case (?user) {
        user.passwordHash == passwordHash and user.isEnabled;
      };
    };
  };

  // Check if any admin app user exists (anonymous OK - needed for initial setup flow)
  public query func appUserHasAdmin() : async Bool {
    var found = false;
    for (u in appUsers.values()) {
      if (u.role == #admin and u.isEnabled) { found := true };
    };
    found;
  };

  // List all app users — open to all callers (returns public info only, no passwordHash)
  public query func listAppUsers() : async [AppUserPublic] {
    appUsers.values().toArray().map(
      func(user : AppUser) : AppUserPublic {
        {
          username = user.username;
          fullName = user.fullName;
          role = user.role;
          originalRole = user.originalRole;
          elevatedUntil = user.elevatedUntil;
          isEnabled = user.isEnabled;
        };
      }
    );
  };

  // Create or update app user — no IC auth (app-level auth via username/password)
  public shared func upsertAppUser(user : AppUser) : async () {
    appUsers.add(user.username.toLower(), user);
    stableAppUsers := appUsers.entries().toArray();
  };

  // Seed default admin — only works if no users exist yet
  // No IC auth check: the setup form runs before any IC login
  public shared func seedAppAdmin(user : AppUser) : async Bool {
    if (appUsers.values().toArray().size() > 0) { return false };
    appUsers.add(user.username.toLower(), user);
    stableAppUsers := appUsers.entries().toArray();
    true;
  };

  // Persist appUsers to stable storage before canister upgrade
  system func preupgrade() {
    stableAppUsers := appUsers.entries().toArray();
  };

  // Restore appUsers from stable storage after upgrade
  system func postupgrade() {
    for ((k, v) in stableAppUsers.vals()) {
      appUsers.add(k, v);
    };
  };

};
