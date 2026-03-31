import Map "mo:core/Map";
import Text "mo:core/Text";

// Type Aliases for Old & New Actor
module {
  // AppRole type mapping to AccessControl roles
  type AppRole = {
    #admin;
    #manager;
    #reviewer;
    #auditor;
  };

  // === APP USER MANAGEMENT (username/password auth, no IC identity needed for login) ===
  type AppUser = {
    username : Text;
    passwordHash : Text;
    fullName : Text;
    role : AppRole;
    originalRole : AppRole;
    elevatedUntil : ?Int;
    isEnabled : Bool;
  };

  // Legacy Types
  type OldActor = {
    appUsers : Map.Map<Text, AppUser>;
  };
  type NewActor = {
    appUsers : Map.Map<Text, AppUser>;
    templateBlobs : Map.Map<Text, { id : Text; dataJson : Text; updatedAt : Int; createdBy : Text }>;
    auditBlobs : Map.Map<Text, { siteId : Text; dataJson : Text; status : Text; lastSavedAt : Int }>;
  };

  // Run Data Migration
  public func run(old : OldActor) : NewActor {
    { old with
      templateBlobs = Map.empty<Text, { id : Text; dataJson : Text; updatedAt : Int; createdBy : Text }>();
      auditBlobs = Map.empty<Text, { siteId : Text; dataJson : Text; status : Text; lastSavedAt : Int }>();
    };
  };
};
