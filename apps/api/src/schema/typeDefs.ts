export const typeDefs = /* GraphQL */ `
  enum AnimalCategory {
    PET
    FARM
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
  }

  type Location {
    postcode: String!
    latitude: Float!
    longitude: Float!
    region: String
  }

  type DailyRisk {
    date: String!
    level: RiskLevel!
    score: Int!
    reason: String!
    "General husbandry checks for this level (FR-5.1). Empty at LOW."
    checks: [String!]!
  }

  type RiskForecast {
    riskId: ID!
    name: String!
    category: AnimalCategory!
    animals: [String!]!
    days: [DailyRisk!]!
  }

  type Forecast {
    location: Location!
    generatedAt: String!
    risks: [RiskForecast!]!
  }

  type Animal {
    id: ID!
    name: String!
    species: String!
    category: AnimalCategory!
    "Where the pet lives, for its own forecast (FR-2.6)"
    postcode: String
    "Walks in long grass or woodland: raises tick risk"
    highExposureHabitat: Boolean!
    "v3: email the owner a week before, on the day and 3 days after a next due date"
    remindersEnabled: Boolean!
    "Newest first"
    logs: [LogEntry!]!
    "Risks for this species at its postcode; null without a postcode"
    forecast: Forecast
    "v3: dogs only; null without a postcode or hourly forecast"
    walkPlanner: WalkPlan
  }

  "Omitted fields are unchanged; a null postcode clears it."
  input UpdateAnimalInput {
    name: String
    postcode: String
    highExposureHabitat: Boolean
    remindersEnabled: Boolean
  }

  "Omitted fields are unchanged; null clears the note or next due date."
  input UpdateLogEntryInput {
    date: String
    type: String
    note: String
    nextDueDate: String
    "v3; null clears"
    weightKg: Float
  }

  enum WalkLevel {
    GOOD
    WARM
    HOT
  }

  type WalkHour {
    time: String!
    tempC: Float!
    level: WalkLevel!
  }

  "v3: the best hours for a dog walk, by temperature"
  type WalkPlan {
    date: String!
    hours: [WalkHour!]!
    "Runs of good hours, e.g. 06:00–09:00"
    bestTimes: [String!]!
  }

  type LogEntry {
    id: ID!
    date: String!
    type: String!
    note: String
    nextDueDate: String
    "v3: weight on the day, kg"
    weightKg: Float
  }

  # --- Farms, fields and livestock groups (FR-2) ---

  enum Species {
    CATTLE
    SHEEP
  }

  enum LivestockClass {
    EWES
    LAMBS
    RAMS
    DAIRY_COWS
    BEEF_CATTLE
    CALVES
  }

  enum CattleType {
    DAIRY
    BEEF
  }

  "Where a group's forecast location came from: field pin, field postcode, or farm postcode."
  enum LocationSource {
    PIN
    FIELD_POSTCODE
    FARM_POSTCODE
  }

  type Farm {
    id: ID!
    name: String!
    postcode: String!
    "Active fields, by name"
    fields: [Field!]!
    "Active groups, by name"
    groups: [LivestockGroup!]!
    archivedFields: [Field!]!
    "Sold or finished groups; their records are kept"
    archivedGroups: [LivestockGroup!]!
    "The signed-in user's role here (FR-8.2)"
    myRole: FarmRole!
    "In the order they joined"
    members: [FarmMember!]!
    "Invitations not yet accepted"
    invites: [FarmInvite!]!
    "v3 holding details"
    cphNumber: String
    flockMark: String
    "v3: where the farm postcode is, for the map"
    location: GeoPoint!
    "v3: 14-day daily weather at the farm postcode"
    weather: [WeatherDay!]!
    "v3: twelve-month figures for the dashboard"
    stats: FarmStats!
    "v3: things that need attention, most urgent first"
    alerts: [Alert!]!
    "v3: recent records, moves and register entries, newest first"
    activity(limit: Int = 20): [ActivityItem!]!
  }

  type GeoPoint {
    latitude: Float!
    longitude: Float!
  }

  type WeatherDay {
    date: String!
    tempMeanC: Float!
    tempMaxC: Float!
    tempMinC: Float!
    humidityMeanPct: Float!
    precipitationMm: Float!
  }

  type FarmStats {
    totalHead: Int!
    sheep: Int!
    cattle: Int!
    "The following are for the last 12 months"
    bornAlive: Int!
    bornDead: Int!
    deaths: Int!
    movedOn: Int!
    movedOff: Int!
    "Deaths as a % of animals kept over the year"
    mortalityPct: Float
    "Born alive as a % of all born"
    birthSurvivalPct: Float
    groupsInWithdrawal: Int!
    openTasks: Int!
    overdueTasks: Int!
  }

  enum AlertLevel {
    URGENT
    WARNING
    INFO
  }

  type Alert {
    level: AlertLevel!
    title: String!
    detail: String!
    "Path in the web app"
    link: String!
  }

  type ActivityItem {
    date: String!
    "TREATMENT, CHECK, MOVE or a register entry kind"
    kind: String!
    title: String!
    detail: String
    groupId: ID
    groupName: String
  }

  enum GrazingStatus {
    GRAZED
    RESTING
    NEVER_USED
  }

  type Grazing {
    status: GrazingStatus!
    "Days grazed so far, or rested since the last group left"
    days: Int
    "Groups in the field now"
    groups: [String!]!
  }

  "v3 holding register: births, deaths, moves on and off the holding, and measurements"
  enum RegisterEventKind {
    BIRTH
    DEATH
    MOVE_ON
    MOVE_OFF
    WEIGHING
    FEC
    BODY_CONDITION
    TAG_REPLACEMENT
    HEAD_COUNT
  }

  type RegisterEvent {
    id: ID!
    kind: RegisterEventKind!
    date: String!
    group: LivestockGroup!
    "Animals (born alive for births; the counted total for a head count)"
    count: Int
    bornDead: Int
    "Average kg (weighing), eggs per gram (FEC) or average score (body condition)"
    value: Float
    "The other holding, market or abattoir for a move"
    otherParty: String
    reference: String
    cause: String
    note: String
    recordedBy: String!
    recordedAt: String!
    voided: Boolean!
    voidReason: String
  }

  input RegisterEventInput {
    groupId: ID!
    kind: RegisterEventKind!
    date: String!
    count: Int
    bornDead: Int
    value: Float
    otherParty: String
    reference: String
    cause: String
    note: String
  }

  type RegisterRow {
    event: RegisterEvent!
    "The group's head count straight after this entry, when known"
    headCountAfter: Int
  }

  type WeightPoint {
    date: String!
    averageKg: Float!
    "Daily live-weight gain since the previous weighing"
    dailyGainKg: Float
  }

  enum MedicineStatus {
    OK
    EXPIRING
    EXPIRED
    FINISHED
  }

  "A product in the medicine cabinet, typed by the farmer from the label"
  type MedicineItem {
    id: ID!
    productName: String!
    batchNumber: String
    quantity: String
    expiryDate: String
    supplier: String
    purchasedOn: String
    meatWithdrawalDays: Int
    milkWithdrawalDays: Int
    note: String
    finishedOn: String
    status: MedicineStatus!
  }

  "Omitted fields are unchanged on update; null clears an optional one"
  input MedicineInput {
    productName: String
    batchNumber: String
    quantity: String
    expiryDate: String
    supplier: String
    purchasedOn: String
    meatWithdrawalDays: Int
    milkWithdrawalDays: Int
    note: String
    finishedOn: String
  }

  "FR-8.2: OWNER manages everything; WORKER records, moves and does tasks; VIEWER can only look."
  enum FarmRole {
    OWNER
    WORKER
    VIEWER
  }

  type FarmMember {
    userId: ID!
    email: String!
    role: FarmRole!
    isMe: Boolean!
  }

  type FarmInvite {
    id: ID!
    email: String!
    role: FarmRole!
  }

  "An invitation for the signed-in user, by their email"
  type MyInvite {
    id: ID!
    farmName: String!
    role: FarmRole!
    "Email of whoever sent it"
    invitedBy: String
  }

  type Field {
    id: ID!
    name: String!
    postcode: String
    latitude: Float
    longitude: Float
    archived: Boolean!
    archivedOn: String
    "v3 grazing rotation"
    grazing: Grazing!
  }

  type LivestockGroup {
    id: ID!
    name: String!
    species: Species!
    livestockClass: LivestockClass!
    headCount: Int!
    housed: Boolean!
    currentField: Field
    "Sheep only"
    lastShearingDate: String
    lambingStart: String
    lambingEnd: String
    lambsAtGrassThisSpring: Boolean!
    "Cattle only"
    cattleType: CattleType
    calvingStart: String
    calvingEnd: String
    "Newest first"
    movements: [GroupMovement!]!
    forecast: GroupForecast!
    farm: Farm!
    "Newest first (FR-6.1)"
    treatments: [Treatment!]!
    "Newest first (FR-6.6)"
    observations: [Observation!]!
    "Whether the group is in withdrawal today (FR-6.2)"
    withdrawal: WithdrawalStatus!
    "Set when the group was sold or finished"
    archivedOn: String
    archiveReason: String
    "v3: births, deaths, moves and measurements, newest first"
    registerEvents: [RegisterEvent!]!
    "v3: weighings, oldest first, with daily live-weight gain"
    weights: [WeightPoint!]!
  }

  # --- Records (FR-6) ---

  "A treatment record. Product and withdrawal periods are typed in by the farmer from the label or vet."
  type Treatment {
    id: ID!
    date: String!
    productName: String!
    batchNumber: String
    quantityUsed: String
    animalsTreated: Int!
    administeredBy: String!
    reason: String
    meatWithdrawalDays: Int!
    milkWithdrawalDays: Int
    "First day out of meat withdrawal"
    meatWithdrawalEnds: String!
    "First day out of milk withdrawal, if a milk period was entered"
    milkWithdrawalEnds: String
    group: LivestockGroup!
    "Voided records stay on file but don't count for withdrawal (FR-6.5)"
    voided: Boolean!
    voidedAt: String
    voidReason: String
    "Corrections and voids, newest first"
    history: [RecordRevision!]!
  }

  type Observation {
    id: ID!
    date: String!
    type: String!
    note: String
    voided: Boolean!
    voidedAt: String
    voidReason: String
    "Corrections and voids, newest first"
    history: [RecordRevision!]!
  }

  enum RevisionAction {
    EDITED
    VOIDED
  }

  "One correction or void (FR-6.5). Never changed or deleted."
  type RecordRevision {
    id: ID!
    action: RevisionAction!
    "ISO timestamp"
    at: String!
    "Email of whoever made the change"
    by: String!
    reason: String!
    changes: [FieldChange!]!
  }

  type FieldChange {
    field: String!
    from: String
    to: String
  }

  "Omitted fields are unchanged. To move a record to another group, void it and record it again."
  input CorrectTreatmentInput {
    date: String
    productName: String
    batchNumber: String
    quantityUsed: String
    animalsTreated: Int
    administeredBy: String
    reason: String
    meatWithdrawalDays: Int
    milkWithdrawalDays: Int
  }

  input CorrectObservationInput {
    date: String
    type: String
    note: String
  }

  type WithdrawalStatus {
    inWithdrawal: Boolean!
    "Latest meat withdrawal end still to come"
    meatEnds: String
    "Latest milk withdrawal end still to come"
    milkEnds: String
  }

  input RecordTreatmentInput {
    groupId: ID!
    date: String!
    productName: String!
    batchNumber: String
    quantityUsed: String
    animalsTreated: Int!
    administeredBy: String!
    reason: String
    meatWithdrawalDays: Int!
    milkWithdrawalDays: Int
  }

  # --- Briefing and tasks (FR-4, FR-5) ---

  type Briefing {
    farm: Farm!
    "UK date this briefing is for"
    date: String!
    generatedAt: String!
    "True when today's briefing couldn't be made and an earlier one is shown"
    isStale: Boolean!
    "FR-5.5: shown at the top"
    overdueTasks: [Task!]!
    "Groups with Medium or High risks in the next 7 days, most severe first"
    groups: [BriefingGroup!]!
    "Groups with nothing to flag: 'No concerns this week'"
    quietGroups: [QuietGroup!]!
    flaggedCount: Int!
  }

  type BriefingGroup {
    groupId: ID!
    groupName: String!
    fieldName: String
    items: [BriefingItem!]!
  }

  type QuietGroup {
    groupId: ID!
    groupName: String!
  }

  type BriefingItem {
    riskId: ID!
    riskName: String!
    level: RiskLevel!
    daysAffected: [AffectedDay!]!
    reason: String!
    checks: [String!]!
    "High today but not High in yesterday's briefing (FR-4.4)"
    isNew: Boolean!
  }

  type AffectedDay {
    date: String!
    level: RiskLevel!
  }

  type Task {
    id: ID!
    title: String!
    dueDate: String!
    note: String
    done: Boolean!
    overdue: Boolean!
    "Null for a farm-wide task"
    group: LivestockGroup
    "When done, the next one is made this many days later on the same schedule (FR-5.3)"
    repeatEveryDays: Int
    "FR-5.4: the farm member it's assigned to"
    assignee: User
    assignedToMe: Boolean!
  }

  type BriefingPreferences {
    emailEnabled: Boolean!
    "HH:MM, UK time"
    sendAt: String!
    "Send even when nothing is flagged"
    alwaysSend: Boolean!
  }

  "Give a groupId, or a farmId for a farm-wide task."
  input CreateTaskInput {
    groupId: ID
    farmId: ID
    title: String!
    dueDate: String!
    note: String
    repeatEveryDays: Int
    "A worker or owner on the farm"
    assigneeId: ID
  }

  "Omitted fields are unchanged; null clears the group (whole farm), note, repeat or assignee."
  input UpdateTaskInput {
    title: String
    dueDate: String
    note: String
    groupId: ID
    repeatEveryDays: Int
    assigneeId: ID
  }

  input BriefingPreferencesInput {
    emailEnabled: Boolean!
    sendAt: String!
    alwaysSend: Boolean!
  }

  input RecordObservationInput {
    groupId: ID!
    date: String!
    type: String!
    note: String
  }

  type GroupMovement {
    id: ID!
    movedOn: String!
    fromField: Field
    toField: Field!
  }

  type ResolvedLocation {
    source: LocationSource!
    latitude: Float!
    longitude: Float!
    postcode: String
  }

  type GroupForecast {
    location: ResolvedLocation!
    generatedAt: String!
    risks: [RiskForecast!]!
  }

  input CreateFarmInput {
    name: String!
    postcode: String!
  }

  "Give a postcode, a map pin (latitude + longitude), or neither to use the farm postcode."
  input CreateFieldInput {
    farmId: ID!
    name: String!
    postcode: String
    latitude: Float
    longitude: Float
  }

  input CreateLivestockGroupInput {
    farmId: ID!
    name: String!
    species: Species!
    livestockClass: LivestockClass!
    headCount: Int!
    currentFieldId: ID
    housed: Boolean
    lastShearingDate: String
    lambingStart: String
    lambingEnd: String
    lambsAtGrassThisSpring: Boolean
    cattleType: CattleType
    calvingStart: String
    calvingEnd: String
  }

  "Omitted fields are unchanged; null clears a date or cattle type. Use moveLivestockGroup to change field."
  input UpdateLivestockGroupInput {
    name: String
    livestockClass: LivestockClass
    headCount: Int
    housed: Boolean
    lastShearingDate: String
    lambingStart: String
    lambingEnd: String
    lambsAtGrassThisSpring: Boolean
    cattleType: CattleType
    calvingStart: String
    calvingEnd: String
  }

  "Omitted fields are unchanged."
  input UpdateFarmInput {
    name: String
    postcode: String
    "County Parish Holding number; blank clears"
    cphNumber: String
    "Flock or herd mark; blank clears"
    flockMark: String
  }

  "Omitted fields are unchanged; null clears the postcode or map pin."
  input UpdateFieldInput {
    name: String
    postcode: String
    latitude: Float
    longitude: Float
  }

  input ArchiveLivestockGroupInput {
    "The day it was sold or finished"
    archivedOn: String!
    reason: String!
  }

  input MoveLivestockGroupInput {
    groupId: ID!
    toFieldId: ID!
    movedOn: String!
  }

  # --- Users (FR-8.1) ---

  type User {
    id: ID!
    email: String!
  }

  "v4: who a farm or pet owner deals with"
  enum ContactKind {
    VET
    FEED
    SUPPLIER
    OTHER
  }

  type Contact {
    id: ID!
    kind: ContactKind!
    name: String!
    phone: String
    "Out-of-hours or emergency line"
    emergencyPhone: String
    email: String
    website: String
    address: String
    notes: String
    "Null for a personal contact"
    farmName: String
  }

  "Omit farmId for a personal contact (e.g. your pet's vet)."
  input ContactInput {
    farmId: ID
    kind: ContactKind!
    name: String!
    phone: String
    emergencyPhone: String
    email: String
    website: String
    address: String
    notes: String
  }

  type Query {
    "v4: a farm's contacts, or your own when farmId is omitted"
    contacts(farmId: ID): [Contact!]!
    "v4: every vet you can call, from your farms and your own contacts, out-of-hours first"
    emergencyContacts: [Contact!]!
    "The signed-in user, or null."
    me: User
    forecast(postcode: String!, category: AnimalCategory!, highExposureHabitat: Boolean): Forecast!
    animals: [Animal!]!
    animal(id: ID!): Animal
    farms: [Farm!]!
    farm(id: ID!): Farm
    livestockGroup(id: ID!): LivestockGroup
    "A farm's treatments from 'from' to 'to' inclusive, oldest first (FR-6.4)"
    treatments(farmId: ID!, from: String!, to: String!): [Treatment!]!
    "Today's stored briefing (FR-4.1, FR-4.5); null if the farm isn't yours"
    briefing(farmId: ID!): Briefing
    "Earliest due first"
    tasks(farmId: ID!): [Task!]!
    briefingPreferences(farmId: ID!): BriefingPreferences!
    "Farm invitations for the signed-in user's email (FR-8.2)"
    myInvites: [MyInvite!]!
    "v3: the holding register, newest first"
    holdingRegister(farmId: ID!): [RegisterRow!]!
    "v3: every register entry and measurement, newest first, voided ones included"
    registerEvents(farmId: ID!): [RegisterEvent!]!
    "v3: the medicine cabinet, soonest expiry first"
    medicines(farmId: ID!): [MedicineItem!]!
  }

  type Mutation {
    createAnimal(
      name: String!
      species: String!
      category: AnimalCategory!
      postcode: String
      highExposureHabitat: Boolean
    ): Animal!
    updateAnimal(id: ID!, input: UpdateAnimalInput!): Animal!
    "Deletes the animal and its log. False if it isn't yours."
    deleteAnimal(id: ID!): Boolean!
    addLogEntry(
      animalId: ID!
      date: String!
      type: String!
      note: String
      nextDueDate: String
      weightKg: Float
    ): LogEntry!
    updateLogEntry(id: ID!, input: UpdateLogEntryInput!): LogEntry!
    deleteLogEntry(id: ID!): Boolean!
    createFarm(input: CreateFarmInput!): Farm!
    createField(input: CreateFieldInput!): Field!
    createLivestockGroup(input: CreateLivestockGroupInput!): LivestockGroup!
    updateLivestockGroup(id: ID!, input: UpdateLivestockGroupInput!): LivestockGroup!
    moveLivestockGroup(input: MoveLivestockGroupInput!): GroupMovement!
    updateFarm(id: ID!, input: UpdateFarmInput!): Farm!
    "Deletes the farm and everything on it. confirmName must match the farm's name."
    deleteFarm(id: ID!, confirmName: String!): Boolean!
    updateField(id: ID!, input: UpdateFieldInput!): Field!
    "Archived fields keep their history but take no new moves"
    setFieldArchived(id: ID!, archived: Boolean!): Field!
    "For a sold or finished group: records are kept, briefings skip it"
    archiveLivestockGroup(id: ID!, input: ArchiveLivestockGroupInput!): LivestockGroup!
    restoreLivestockGroup(id: ID!): LivestockGroup!
    "Creates an account and signs in (sets the session cookie)."
    signUp(email: String!, password: String!): User!
    "Signs in (sets the session cookie)."
    logIn(email: String!, password: String!): User!
    "Ends the session and clears the cookie."
    logOut: Boolean!
    recordTreatment(input: RecordTreatmentInput!): Treatment!
    recordObservation(input: RecordObservationInput!): Observation!
    "Corrects a treatment; 'reason' is kept in its history (FR-6.5)"
    correctTreatment(id: ID!, input: CorrectTreatmentInput!, reason: String!): Treatment!
    "Marks a treatment void. It is never deleted (FR-6.5)."
    voidTreatment(id: ID!, reason: String!): Treatment!
    correctObservation(id: ID!, input: CorrectObservationInput!, reason: String!): Observation!
    voidObservation(id: ID!, reason: String!): Observation!
    "Rebuilds today's briefing now"
    refreshBriefing(farmId: ID!): Briefing!
    createTask(input: CreateTaskInput!): Task!
    "Done on a repeating task also makes the next one (FR-5.3)"
    setTaskDone(id: ID!, done: Boolean!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    "False if the task isn't yours"
    deleteTask(id: ID!): Boolean!
    setBriefingPreferences(farmId: ID!, input: BriefingPreferencesInput!): BriefingPreferences!
    "Owners only. Inviting the same email again changes the role."
    inviteMember(farmId: ID!, email: String!, role: FarmRole!): FarmInvite!
    cancelInvite(id: ID!): Boolean!
    "Joins the farm; the invite must be for the signed-in user's email"
    acceptInvite(id: ID!): Farm!
    declineInvite(id: ID!): Boolean!
    "Owners only. A farm always keeps at least one owner."
    setMemberRole(farmId: ID!, userId: ID!, role: FarmRole!): Boolean!
    "Owners can remove anyone; members can remove themselves to leave"
    removeMember(farmId: ID!, userId: ID!): Boolean!
    "v3: workers and owners. Births, deaths and moves change the group's head count."
    recordRegisterEvent(input: RegisterEventInput!): RegisterEvent!
    "v3: kept and struck through; its head count change is undone"
    voidRegisterEvent(id: ID!, reason: String!): RegisterEvent!
    addMedicine(farmId: ID!, input: MedicineInput!): MedicineItem!
    updateMedicine(id: ID!, input: MedicineInput!): MedicineItem!
    deleteMedicine(id: ID!): Boolean!
    "v3: a ready-made farm to explore, owned by the signed-in user"
    createDemoFarm(postcode: String!): Farm!
    "v3.2: a new account with two demo farms, a team and pets, signed in straight away"
    startDemo(postcode: String): User!
    addContact(input: ContactInput!): Contact!
    "farmId in the input is ignored: a contact stays where it was added"
    updateContact(id: ID!, input: ContactInput!): Contact!
    deleteContact(id: ID!): Boolean!
  }
`;
