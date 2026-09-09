/**
 * The English message catalogue, and the source of truth for the key set:
 * `hy.ts` is typed against it, so a missing or misspelled Armenian key is a
 * compile error rather than an English word appearing mid-sentence in
 * production.
 *
 * Placeholders are `{name}` and are substituted by `translator()`.
 */
export const en = {
  'app.name': 'Cruncholino Trees',
  'app.description': 'Map the fruit and nut trees around you.',

  'common.signIn': 'Sign in',
  'common.signOut': 'Sign out',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.edit': 'Edit',
  'common.loading': 'Loading…',
  'common.reset': 'Reset',
  'common.saving': 'Saving…',
  'common.status': 'Status',
  'common.none': '—',

  'nav.map': 'Map',
  'nav.add': 'Add a tree',
  'nav.myTrees': 'My trees',
  'nav.admin': 'Admin',
  'nav.dashboard': 'Dashboard',

  'language.label': 'Language',

  'home.title': 'Map the fruit and nut trees around you',
  'home.subtitle':
    'Record a tree in under a minute: where it is, what it is, and how it’s doing. Everything recorded shows up on a shared map.',
  'home.addTree': 'Add a tree',
  'home.openMap': 'Open the map',
  'home.signInToOpen': 'Sign in to open the map',
  'home.private':
    'Tree locations are visible to signed-in members only. Signing in takes one email.',
  'home.statTrees': 'Trees recorded',
  'home.statSpecies': 'Species',
  'home.statPlaces': 'Places',

  'signin.title': 'Sign in',
  'signin.subtitle': 'We’ll email you a link — there’s no password to remember or lose.',
  'signin.email': 'Email address',
  'signin.sendLink': 'Email me a sign-in link',
  'signin.sending': 'Sending…',
  'signin.devButton': 'Sign in (development)',
  'signin.devHint':
    'Development sign-in is enabled: any address signs in immediately, no email sent. Try admin@example.org.',
  'signin.failed': 'Sign-in failed ({error}). Try again.',
  'signin.errorConfiguration':
    'We couldn’t send the email. This is a problem with the site’s mail settings, not with anything you did — retrying won’t help. Please tell whoever runs this site; the details are in the server log.',
  'signin.errorVerification':
    'That sign-in link has expired or has already been used. Request a new one below.',
  'signin.errorAccessDenied': 'That account is not allowed to sign in.',
  'signin.noMethod':
    'No sign-in method is configured. Set EMAIL_SERVER for magic-link sign-in, or AUTH_DEV_LOGIN=true in development.',
  'signin.checkEmailTitle': 'Check your email',
  'signin.checkEmailBody':
    'We sent you a sign-in link. It expires in 24 hours, and opening it on the same device keeps you signed in there.',

  'add.title': 'Add a tree',
  'add.step1': '1. Where is it?',
  'add.step2': '2. What is it?',
  'add.step3': '3. How is it doing?',
  'add.step4': '4. Anything else? (optional)',
  'add.save': 'Save tree',
  'add.recorded': 'Tree recorded',
  'add.addressFound': 'Address we found',
  'add.noAddress': 'No address found for this position',
  'add.lookupFailed':
    'The address lookup failed. The coordinates are saved correctly — you can fill the city in here.',
  'add.saveCorrection': 'Save correction',
  'add.addAnother': 'Add another tree',
  'add.seeOnMap': 'See it on the map',
  'add.correctionFailed': 'Could not save the correction',
  'add.queuedTitle': 'Saved on this device',
  'add.queuedBody':
    'There was no usable connection, so the tree is queued and will upload by itself when you’re back online. You can keep adding trees.',
  'add.trySync': 'Try syncing now',
  'add.duplicateHint':
    'If one of them is the same tree, an admin can merge them later — your record is saved either way.',
  'add.needPosition': 'Set the tree’s position first.',
  'add.needSpecies': 'Pick a species',
  'add.sessionExpired': 'Your session expired. Sign in again — your entry is saved on this device.',
  'add.notesPlaceholder': 'Anything worth knowing — access, ownership, damage…',

  'location.useMine': 'Use my location',
  'location.finding': 'Finding you…',
  'location.none': 'No position yet — tap the map to drop a pin.',
  'location.denied':
    'Location permission is off. Drag the pin to where the tree is, or upload a photo taken next to it.',
  'location.failed': 'Could not get a GPS fix. Drag the pin to where the tree is.',
  'location.unsupported':
    'This browser cannot report your location. Drop a pin on the map instead.',
  'location.hint': 'Tap the map or drag the pin to correct the position.',

  'species.label': 'Species',
  'species.searchPlaceholder': 'Search — apricot, ծիրան…',
  'species.noMatch': 'No species matches “{query}”. Ask an admin to add it.',

  'field.species': 'Species',
  'field.condition': 'Condition of the tree',
  'field.fruitQuality': 'Fruit quality',
  'field.age': 'Age',
  'field.city': 'City',
  'field.region': 'Region',
  'field.notes': 'Notes',
  'field.status': 'Status',
  'field.photos': 'Photos',

  'condition.GOOD': 'Good',
  'condition.GOOD.hint': 'Healthy, no visible damage',
  'condition.FAIR': 'Fair',
  'condition.FAIR.hint': 'Some damage or stress',
  'condition.POOR': 'Poor',
  'condition.POOR.hint': 'Badly damaged or diseased',
  'condition.DEAD': 'Dead',
  'condition.DEAD.hint': 'No longer alive',
  'condition.UNKNOWN': 'Not sure',
  'condition.UNKNOWN.hint': '',

  'age.YOUNG': 'Young',
  'age.YOUNG.hint': 'Sapling, thin trunk',
  'age.MID': 'Mature',
  'age.MID.hint': 'Full grown, bearing',
  'age.OLD': 'Old',
  'age.OLD.hint': 'Thick trunk, veteran',
  'age.UNKNOWN': 'Not sure',
  'age.UNKNOWN.hint': '',

  'fruit.GOOD': 'Good',
  'fruit.GOOD.hint': 'Worth picking',
  'fruit.FAIR': 'Fair',
  'fruit.FAIR.hint': 'Edible, unremarkable',
  'fruit.POOR': 'Poor',
  'fruit.POOR.hint': 'Small, damaged or sour',
  'fruit.NONE': 'No fruit',
  'fruit.NONE.hint': 'Not bearing this year',
  'fruit.UNKNOWN': 'Not sure',
  'fruit.UNKNOWN.hint': '',

  'category.FRUIT': 'Fruit',
  'category.NUT': 'Nut',
  'category.BERRY': 'Berry',
  'category.ORNAMENTAL': 'Ornamental',
  'category.OTHER': 'Other',

  'treeStatus.DRAFT': 'Draft',
  'treeStatus.PUBLISHED': 'Published',
  'treeStatus.FLAGGED': 'Flagged',
  'treeStatus.ARCHIVED': 'Archived',

  'photos.add': '+ Photo',
  'photos.remove': 'Remove photo',
  'photos.hint': 'Photos are resized to 1600 px in your browser before upload.',
  'photos.unavailable':
    'Photo upload is not configured on this deployment. Everything else still works.',

  'filters.title': 'Filters',
  'filters.counting': 'Counting…',
  'filters.matchCount': '{count} trees match',
  'filters.searchLabel': 'Search notes and addresses',
  'filters.searchPlaceholder': 'e.g. schoolyard, Mashtots',
  'filters.anyCity': 'Any city',
  'filters.anyRegion': 'Any region',
  'filters.showResults': 'Show {count} results',
  'filters.resetWithCount': 'Reset ({count})',

  'legend.title': 'Legend',
  'legend.colour': 'Colour — condition',
  'legend.shape': 'Shape — category',
  'legend.size': 'Size — age',

  'stats.trees': '{count} trees',
  'stats.counting': 'Counting trees…',

  'dashboard.map': 'map',
  'dashboard.list': 'list',
  'dashboard.filters': 'Filters',
  'dashboard.exportCsv': 'Export CSV',
  'dashboard.clustered': 'Showing clusters — zoom in for individual trees',
  'dashboard.loading': 'Loading dashboard…',

  'list.sort': 'Sort',
  'list.results': '{count} results',
  'list.address': 'Address',
  'list.recorded': 'Recorded',
  'list.empty': 'No trees match these filters.',
  'list.previous': '← Previous',
  'list.next': 'Next →',
  'list.page': 'Page {page} of {pages}',
  'sort.newest': 'Newest first',
  'sort.oldest': 'Oldest first',
  'sort.species': 'Species A–Z',
  'sort.condition': 'Condition',
  'sort.city': 'City A–Z',

  'detail.tree': 'Tree',
  'detail.condition': 'Condition',
  'detail.fruit': 'Fruit',
  'detail.age': 'Age',
  'detail.address': 'Address',
  'detail.coordinates': 'Coordinates',
  'detail.addedBy': 'Added by',
  'detail.recorded': 'Recorded',
  'detail.anonymous': 'Anonymous',
  'detail.approximate': '(approximate)',
  'detail.lookupFailed': '(lookup failed)',
  'detail.manual': '(entered by hand)',
  'detail.years': '~{years} years',
  'detail.directions': 'Directions',
  'detail.history': 'History ({count})',
  'detail.close': 'Close details',

  'myTrees.title': 'My trees',
  'myTrees.empty': 'You haven’t recorded any trees yet.',

  'edit.title': 'Edit tree',
  'edit.position': 'Position',
  'edit.moved': 'The pin moved — the address will be looked up again when you save.',
  'edit.save': 'Save changes',
  'edit.saved': 'Saved.',
  'edit.remove': 'Remove tree',
  'edit.confirmRemove': 'Remove this tree? A reviewer can restore it later.',
  'edit.failed': 'Could not save',
  'edit.deleteFailed': 'Could not delete',
  'edit.notYours': 'Not your tree',
  'edit.notYoursBody':
    'You can only edit trees you added. Ask a reviewer if this one needs correcting.',

  'offline.offline': 'You’re offline — new trees are saved on this device.',
  'offline.waiting': '{count} trees waiting to upload',
  'offline.syncing': '— syncing…',
  'offline.syncNow': 'Sync now',

  'admin.title': 'Admin',
  'admin.signedInAs': 'Signed in as {email} ({role}).',
  'admin.statTrees': 'Trees',
  'admin.statAwaiting': 'Awaiting review',
  'admin.statSpecies': 'Species',
  'admin.statGeocodes': 'Address lookups to retry',
  'admin.reviewTitle': 'Review queue',
  'admin.reviewBody': 'Approve, reject or flag submissions waiting on a decision.',
  'admin.speciesTitle': 'Species',
  'admin.speciesBody': 'Add, rename, deactivate or merge duplicates.',
  'admin.exportCsvTitle': 'Export CSV',
  'admin.exportCsvBody': 'Every tree, with the dashboard’s filters applied.',
  'admin.exportGeojsonTitle': 'Export GeoJSON',
  'admin.exportGeojsonBody': 'For QGIS and anything else that reads geometry.',

  'review.title': 'Review queue',
  'review.subtitle': 'Submissions in draft or flagged for a second look.',
  'review.empty': 'Nothing waiting. 🎉',
  'review.view': 'View',
  'review.flag': 'Flag',
  'review.reject': 'Reject',
  'review.approve': 'Approve',
  'review.failed': 'Could not save that decision',
  'review.unknownContributor': 'Unknown',

  'speciesAdmin.title': 'Species',
  'speciesAdmin.subtitle':
    'Species is a table, not an enum — adding one takes effect immediately, with no deploy.',
  'speciesAdmin.slug': 'Slug',
  'speciesAdmin.english': 'English',
  'speciesAdmin.armenian': 'Armenian',
  'speciesAdmin.category': 'Category',
  'speciesAdmin.add': 'Add',
  'speciesAdmin.species': 'Species',
  'speciesAdmin.trees': 'Trees',
  'speciesAdmin.active': 'Active',
  'speciesAdmin.deactivate': 'Deactivate',
  'speciesAdmin.reactivate': 'Reactivate',
  'speciesAdmin.merge': 'Merge…',
  'speciesAdmin.mergeInto': 'Merge into…',
  'speciesAdmin.confirmMerge':
    'Move all {count} {species} trees onto the other species and deactivate {slug}?',
  'speciesAdmin.yes': 'Yes',
  'speciesAdmin.no': 'No',
  'speciesAdmin.failed': 'Something went wrong',

  'map.styleFailed':
    'The base map failed to load ({error}). Check NEXT_PUBLIC_MAP_STYLE_URL and the tile key.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
