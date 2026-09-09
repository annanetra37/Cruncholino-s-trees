/**
 * The Armenian catalogue. Typed as `Messages`, so it cannot drift out of step
 * with `en.ts` without failing the typecheck.
 *
 * A note on vocabulary: "region" is translated as «մարզ», because in Armenia
 * that is what the administrative level actually is — see
 * `src/lib/geocode/armenia.ts`, which canonicalises the geocoder's answer onto
 * the eleven marzer.
 */
import type { Messages } from '@/i18n/messages/en';

export const hy: Messages = {
  'app.name': 'Cruncholino Trees',
  'app.description': 'Քարտեզագրիր շուրջդ եղած պտղատու և ընկուզենի ծառերը։',

  'common.signIn': 'Մուտք',
  'common.signOut': 'Ելք',
  'common.cancel': 'Չեղարկել',
  'common.close': 'Փակել',
  'common.dismiss': 'Փակել',
  'common.edit': 'Խմբագրել',
  'common.loading': 'Բեռնվում է…',
  'common.reset': 'Մաքրել',
  'common.saving': 'Պահպանվում է…',
  'common.status': 'Վիճակ',
  'common.none': '—',

  'nav.map': 'Քարտեզ',
  'nav.add': 'Ավելացնել ծառ',
  'nav.myTrees': 'Իմ ծառերը',
  'nav.admin': 'Կառավարում',
  'nav.dashboard': 'Վահանակ',

  'language.label': 'Լեզու',

  'home.title': 'Քարտեզագրիր շուրջդ եղած պտղատու և ընկուզենի ծառերը',
  'home.subtitle':
    'Գրանցիր ծառը մեկ րոպեից էլ քիչ ժամանակում՝ որտեղ է, ինչ է և ինչ վիճակում է։ Գրանցված ամեն ծառ հայտնվում է ընդհանուր քարտեզի վրա։',
  'home.addTree': 'Ավելացնել ծառ',
  'home.openMap': 'Բացել քարտեզը',
  'home.signInToOpen': 'Մուտք գործիր՝ քարտեզը բացելու համար',
  'home.private':
    'Ծառերի տեղադրությունը տեսանելի է միայն գրանցված մասնակիցներին։ Մուտքի համար բավական է մեկ նամակ։',
  'home.statTrees': 'Գրանցված ծառ',
  'home.statSpecies': 'Տեսակ',
  'home.statPlaces': 'Վայր',

  'signin.title': 'Մուտք',
  'signin.subtitle': 'Կուղարկենք հղում էլ. փոստով — գաղտնաբառ հիշելու կարիք չկա։',
  'signin.subtitlePassword': 'Մուտք գործիր էլ. հասցեով և գաղտնաբառով։',
  'signin.subtitleBoth': 'Օգտագործիր գաղտնաբառը ստորև, կամ ստացիր մուտքի հղումը էլ. փոստով։',
  'signin.email': 'Էլ. հասցե',
  'signin.sendLink': 'Ուղարկել մուտքի հղումը',
  'signin.sending': 'Ուղարկվում է…',
  'signin.devButton': 'Մուտք (մշակման ռեժիմ)',
  'signin.devHint':
    'Մշակման մուտքը միացված է․ ցանկացած հասցե անմիջապես մուտք է գործում, նամակ չի ուղարկվում։ Փորձիր admin@example.org։',
  'signin.failed': 'Մուտքը չհաջողվեց ({error})։ Փորձիր նորից։',
  'signin.errorConfiguration':
    'Նամակը չհաջողվեց ուղարկել։ Խնդիրը կայքի փոստի կարգավորումների մեջ է, ոչ թե քո արածի — կրկնելն օգուտ չի տա։ Տեղեկացրու կայքը սպասարկողին. մանրամասները սերվերի մատյանում են։',
  'signin.errorVerification':
    'Մուտքի հղման ժամկետն անցել է կամ այն արդեն օգտագործվել է։ Ստացիր նորը ստորև։',
  'signin.errorAccessDenied': 'Այս հաշվին մուտք գործել չի թույլատրվում։',
  'signin.noMethod':
    'Մուտքի եղանակ կարգավորված չէ։ Նշիր EMAIL_SERVER փոփոխականը կամ մշակման ռեժիմում՝ AUTH_DEV_LOGIN=true։',
  'signin.or': 'կամ',
  'signin.passwordTitle': 'Մուտք գաղտնաբառով',
  'signin.password': 'Գաղտնաբառ',
  'signin.passwordButton': 'Մուտք գործել',
  'signin.errorCredentials':
    'Այս էլ. հասցեի և գաղտնաբառի զույգը չճանաչվեց։ Ստուգիր երկուսն էլ. կրկնվող փորձերը սահմանափակվում են։',
  'signin.checkEmailTitle': 'Ստուգիր էլ. փոստդ',
  'signin.checkEmailBody':
    'Ուղարկեցինք մուտքի հղումը։ Այն գործում է 24 ժամ, և նույն սարքում բացելու դեպքում մուտքդ պահպանվում է։',

  'add.title': 'Ավելացնել ծառ',
  'add.step1': '1. Որտե՞ղ է',
  'add.step2': '2. Ի՞նչ ծառ է',
  'add.step3': '3. Ի՞նչ վիճակում է',
  'add.step4': '4. Այլ բան կա՞ (ըստ ցանկության)',
  'add.save': 'Պահպանել ծառը',
  'add.recorded': 'Ծառը գրանցվեց',
  'add.addressFound': 'Գտնված հասցեն',
  'add.noAddress': 'Այս կետի համար հասցե չգտնվեց',
  'add.lookupFailed':
    'Հասցեն չհաջողվեց որոշել։ Կոորդինատները ճիշտ պահպանվել են — քաղաքը կարող ես լրացնել այստեղ։',
  'add.saveCorrection': 'Պահպանել ուղղումը',
  'add.addAnother': 'Ավելացնել ևս մեկ ծառ',
  'add.seeOnMap': 'Տեսնել քարտեզի վրա',
  'add.correctionFailed': 'Ուղղումը չհաջողվեց պահպանել',
  'add.queuedTitle': 'Պահպանվեց այս սարքում',
  'add.queuedBody':
    'Կապ չկար, ուստի ծառը հերթում է և ինքնաբերաբար կուղարկվի, երբ ցանցը վերականգնվի։ Կարող ես շարունակել ծառեր ավելացնել։',
  'add.trySync': 'Փորձել ուղարկել հիմա',
  'add.duplicateHint':
    'Եթե դրանցից մեկը նույն ծառն է, կառավարիչը հետո կմիավորի — քո գրառումը երկու դեպքում էլ պահպանված է։',
  'add.needPosition': 'Նախ նշիր ծառի տեղը։',
  'add.needSpecies': 'Ընտրիր տեսակը',
  'add.sessionExpired':
    'Աշխատաշրջանն ավարտվեց։ Մուտք գործիր նորից — գրառումդ պահպանված է այս սարքում։',
  'add.notesPlaceholder': 'Ամեն օգտակար բան՝ մոտենալու հնարավորություն, սեփականատեր, վնասներ…',

  'location.useMine': 'Օգտագործել իմ տեղը',
  'location.finding': 'Որոնվում է…',
  'location.none': 'Դեռ տեղ չկա — հպիր քարտեզին՝ նշիչը դնելու համար։',
  'location.denied':
    'Տեղորոշման թույլտվությունն անջատված է։ Քաշիր նշիչը ծառի տեղը կամ վերբեռնիր կողքին արված լուսանկար։',
  'location.failed': 'GPS ազդանշանը չստացվեց։ Քաշիր նշիչը ծառի տեղը։',
  'location.unsupported': 'Այս դիտարկիչը չի կարող որոշել տեղդ։ Փոխարենը նշիչը դիր քարտեզի վրա։',
  'location.hint': 'Հպիր քարտեզին կամ քաշիր նշիչը՝ տեղը ճշտելու համար։',

  'species.label': 'Տեսակ',
  'species.searchPlaceholder': 'Որոնում՝ ծիրան, apricot…',
  'species.noMatch': '«{query}»-ին համապատասխան տեսակ չկա։ Խնդրիր կառավարչին ավելացնել այն։',

  'field.species': 'Տեսակ',
  'field.condition': 'Ծառի վիճակը',
  'field.fruitQuality': 'Պտղի որակը',
  'field.age': 'Տարիքը',
  'field.city': 'Քաղաք',
  'field.region': 'Մարզ',
  'field.notes': 'Նշումներ',
  'field.status': 'Կարգավիճակ',
  'field.photos': 'Լուսանկարներ',

  'condition.GOOD': 'Լավ',
  'condition.GOOD.hint': 'Առողջ է, տեսանելի վնաս չկա',
  'condition.FAIR': 'Միջին',
  'condition.FAIR.hint': 'Որոշ վնաս կամ սթրես',
  'condition.POOR': 'Վատ',
  'condition.POOR.hint': 'Ուժեղ վնասված կամ հիվանդ',
  'condition.DEAD': 'Չորացած',
  'condition.DEAD.hint': 'Այլևս կենդանի չէ',
  'condition.UNKNOWN': 'Հայտնի չէ',
  'condition.UNKNOWN.hint': '',

  'age.YOUNG': 'Երիտասարդ',
  'age.YOUNG.hint': 'Տնկի, բարակ բուն',
  'age.MID': 'Հասուն',
  'age.MID.hint': 'Լրիվ աճած, պտղաբերում է',
  'age.OLD': 'Ծեր',
  'age.OLD.hint': 'Հաստ բուն, վաղեմի ծառ',
  'age.UNKNOWN': 'Հայտնի չէ',
  'age.UNKNOWN.hint': '',

  'fruit.GOOD': 'Լավ',
  'fruit.GOOD.hint': 'Արժե հավաքել',
  'fruit.FAIR': 'Միջին',
  'fruit.FAIR.hint': 'Ուտելի, սովորական',
  'fruit.POOR': 'Վատ',
  'fruit.POOR.hint': 'Մանր, վնասված կամ թթու',
  'fruit.NONE': 'Պտուղ չկա',
  'fruit.NONE.hint': 'Այս տարի չի պտղաբերում',
  'fruit.UNKNOWN': 'Հայտնի չէ',
  'fruit.UNKNOWN.hint': '',

  'category.FRUIT': 'Պտղատու',
  'category.NUT': 'Ընկուզեղեն',
  'category.BERRY': 'Հատապտուղ',
  'category.ORNAMENTAL': 'Դեկորատիվ',
  'category.OTHER': 'Այլ',

  'treeStatus.DRAFT': 'Սևագիր',
  'treeStatus.PUBLISHED': 'Հրապարակված',
  'treeStatus.FLAGGED': 'Նշված',
  'treeStatus.ARCHIVED': 'Արխիվացված',

  'photos.add': '+ Լուսանկար',
  'photos.remove': 'Հեռացնել լուսանկարը',
  'photos.hint': 'Լուսանկարները դիտարկիչում փոքրացվում են մինչև 1600 փիքսել՝ ուղարկելուց առաջ։',
  'photos.unavailable':
    'Լուսանկարների պահոցը կարգավորված չէ այս տեղակայման համար։ Մնացած ամեն ինչ աշխատում է։',

  'filters.title': 'Զտիչներ',
  'filters.counting': 'Հաշվվում է…',
  'filters.matchCount': 'Համապատասխանում է {count} ծառ',
  'filters.searchLabel': 'Որոնել նշումներում և հասցեներում',
  'filters.searchPlaceholder': 'օր․՝ դպրոցի բակ, Մաշտոց',
  'filters.anyCity': 'Ցանկացած քաղաք',
  'filters.anyRegion': 'Ցանկացած մարզ',
  'filters.showResults': 'Ցույց տալ {count} արդյունք',
  'filters.resetWithCount': 'Մաքրել ({count})',

  'legend.title': 'Պայմանանշաններ',
  'legend.colour': 'Գույնը՝ վիճակ',
  'legend.shape': 'Ձևը՝ կատեգորիա',
  'legend.size': 'Չափը՝ տարիք',

  'stats.trees': '{count} ծառ',
  'stats.counting': 'Ծառերը հաշվվում են…',

  'dashboard.map': 'քարտեզ',
  'dashboard.list': 'ցանկ',
  'dashboard.filters': 'Զտիչներ',
  'dashboard.exportCsv': 'Ներբեռնել CSV',
  'dashboard.clustered': 'Ցուցադրվում են խմբեր — մոտեցրու առանձին ծառերը տեսնելու համար',
  'dashboard.loading': 'Վահանակը բեռնվում է…',

  'list.sort': 'Դասավորել',
  'list.results': '{count} արդյունք',
  'list.address': 'Հասցե',
  'list.recorded': 'Գրանցվել է',
  'list.empty': 'Այս զտիչներին համապատասխան ծառ չկա։',
  'list.previous': '← Նախորդը',
  'list.next': 'Հաջորդը →',
  'list.page': 'Էջ {page} / {pages}',
  'sort.newest': 'Նորերը սկզբում',
  'sort.oldest': 'Հները սկզբում',
  'sort.species': 'Տեսակ Ա–Ֆ',
  'sort.condition': 'Ըստ վիճակի',
  'sort.city': 'Քաղաք Ա–Ֆ',

  'detail.tree': 'Ծառ',
  'detail.condition': 'Վիճակ',
  'detail.fruit': 'Պտուղ',
  'detail.age': 'Տարիք',
  'detail.address': 'Հասցե',
  'detail.coordinates': 'Կոորդինատներ',
  'detail.addedBy': 'Ավելացրել է',
  'detail.recorded': 'Գրանցվել է',
  'detail.anonymous': 'Անանուն',
  'detail.approximate': '(մոտավոր)',
  'detail.lookupFailed': '(որոնումը ձախողվեց)',
  'detail.manual': '(լրացվել է ձեռքով)',
  'detail.years': '~{years} տարեկան',
  'detail.directions': 'Ուղղություն',
  'detail.history': 'Պատմություն ({count})',
  'detail.close': 'Փակել մանրամասները',

  'myTrees.title': 'Իմ ծառերը',
  'myTrees.empty': 'Դեռ ծառ չես գրանցել։',

  'edit.title': 'Խմբագրել ծառը',
  'edit.position': 'Տեղը',
  'edit.moved': 'Նշիչը տեղափոխվեց — պահպանելիս հասցեն նորից կորոշվի։',
  'edit.save': 'Պահպանել փոփոխությունները',
  'edit.saved': 'Պահպանվեց։',
  'edit.remove': 'Հեռացնել ծառը',
  'edit.confirmRemove': 'Հեռացնե՞լ այս ծառը։ Ստուգողը հետո կարող է վերականգնել այն։',
  'edit.failed': 'Չհաջողվեց պահպանել',
  'edit.deleteFailed': 'Չհաջողվեց հեռացնել',
  'edit.notYours': 'Սա քո ծառը չէ',
  'edit.notYoursBody':
    'Կարող ես խմբագրել միայն քո ավելացրած ծառերը։ Եթե սա պետք է ուղղվի, դիմիր ստուգողին։',

  'offline.offline': 'Ցանց չկա — նոր ծառերը պահվում են այս սարքում։',
  'offline.waiting': 'Ուղարկման սպասում է {count} ծառ',
  'offline.syncing': '— ուղարկվում է…',
  'offline.syncNow': 'Ուղարկել հիմա',

  'admin.title': 'Կառավարում',
  'admin.signedInAs': 'Մուտք է գործել {email} ({role})։',
  'admin.statTrees': 'Ծառեր',
  'admin.statAwaiting': 'Սպասում է ստուգման',
  'admin.statSpecies': 'Տեսակներ',
  'admin.statGeocodes': 'Կրկնելու ենթակա հասցեի որոնումներ',
  'admin.reviewTitle': 'Ստուգման հերթ',
  'admin.reviewBody': 'Հաստատիր, մերժիր կամ նշիր որոշման սպասող գրառումները։',
  'admin.speciesTitle': 'Տեսակներ',
  'admin.speciesBody': 'Ավելացրու, վերանվանիր, անջատիր կամ միավորիր կրկնվողները։',
  'admin.exportCsvTitle': 'Ներբեռնել CSV',
  'admin.exportCsvBody': 'Բոլոր ծառերը՝ վահանակի զտիչներով։',
  'admin.exportGeojsonTitle': 'Ներբեռնել GeoJSON',
  'admin.exportGeojsonBody': 'QGIS-ի և երկրաչափություն կարդացող այլ գործիքների համար։',

  'review.title': 'Ստուգման հերթ',
  'review.subtitle': 'Սևագիր կամ կրկնակի ստուգման նշված գրառումներ։',
  'review.empty': 'Սպասող ոչինչ չկա։ 🎉',
  'review.view': 'Դիտել',
  'review.flag': 'Նշել',
  'review.reject': 'Մերժել',
  'review.approve': 'Հաստատել',
  'review.failed': 'Որոշումը չհաջողվեց պահպանել',
  'review.unknownContributor': 'Անհայտ',

  'speciesAdmin.title': 'Տեսակներ',
  'speciesAdmin.subtitle':
    'Տեսակները աղյուսակ են, ոչ թե հաստատուն ցանկ — նորը ավելացնելն ուժի մեջ է անմիջապես, առանց տեղակայման։',
  'speciesAdmin.slug': 'Կարճ անուն',
  'speciesAdmin.english': 'Անգլերեն',
  'speciesAdmin.armenian': 'Հայերեն',
  'speciesAdmin.category': 'Կատեգորիա',
  'speciesAdmin.add': 'Ավելացնել',
  'speciesAdmin.species': 'Տեսակ',
  'speciesAdmin.trees': 'Ծառեր',
  'speciesAdmin.active': 'Ակտիվ',
  'speciesAdmin.deactivate': 'Անջատել',
  'speciesAdmin.reactivate': 'Միացնել',
  'speciesAdmin.merge': 'Միավորել…',
  'speciesAdmin.mergeInto': 'Միավորել…',
  'speciesAdmin.confirmMerge':
    'Տեղափոխե՞լ բոլոր {count} {species} ծառերը մյուս տեսակի տակ և անջատել {slug}-ը։',
  'speciesAdmin.yes': 'Այո',
  'speciesAdmin.no': 'Ոչ',
  'speciesAdmin.failed': 'Ինչ-որ բան սխալ գնաց',

  'map.styleFailed':
    'Հիմնական քարտեզը չբեռնվեց ({error})։ Ստուգիր NEXT_PUBLIC_MAP_STYLE_URL-ը և սալիկների բանալին։',
};
