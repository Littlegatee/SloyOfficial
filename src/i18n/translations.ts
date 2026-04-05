/** UI strings. Fallback: requested locale → en-GB → ru → key */
export type AppLocale = "ru" | "en-GB" | "en-US" | "tt" | "ce" | "hy" | "tr" | "de";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ru: "Русский",
  "en-GB": "English (UK)",
  "en-US": "English (US)",
  tt: "Татарча",
  ce: "Нохчийн",
  hy: "Հայերեն",
  tr: "Türkçe",
  de: "Deutsch",
};

export type Key =
  | "nav.feed"
  | "nav.profile"
  | "nav.friends"
  | "nav.communities"
  | "nav.messages"
  | "nav.settings"
  | "nav.music"
  | "settings.title"
  | "settings.tab.profile"
  | "settings.tab.appearance"
  | "settings.tab.privacy"
  | "settings.tab.notifications"
  | "settings.tab.language"
  | "settings.language.hint"
  | "settings.privacy.visibility"
  | "settings.privacy.public"
  | "settings.privacy.friends"
  | "settings.privacy.private"
  | "settings.privacy.friendRequests"
  | "settings.privacy.save"
  | "settings.privacy.saved"
  | "profile.limited.title"
  | "profile.limited.message"
  | "music.title"
  | "music.tracks"
  | "music.albums"
  | "music.playlists"
  | "music.upload"
  | "music.titleLabel"
  | "music.artist"
  | "music.cover"
  | "music.visibility"
  | "music.private"
  | "music.public"
  | "music.addToAlbum"
  | "music.addToPlaylist"
  | "music.createAlbum"
  | "music.createPlaylist"
  | "music.delete"
  | "music.empty"
  | "admin.verify"
  | "admin.userId"
  | "admin.grant"
  | "admin.revoke"
  | "admin.done"
  | "common.save"
  | "common.cancel"
  | "profile.edit"
  | "profile.firstName"
  | "profile.lastName"
  | "profile.status"
  | "profile.city"
  | "profile.country"
  | "profile.language"
  | "profile.gender"
  | "profile.interests"
  | "profile.movies"
  | "profile.games"
  | "profile.save"
  | "profile.notSpecified";

const ru: Record<Key, string> = {
  "nav.feed": "Главное",
  "nav.profile": "Профиль",
  "nav.friends": "Друзья",
  "nav.communities": "Сообщества",
  "nav.messages": "Сообщения",
  "nav.settings": "Настройки",
  "nav.music": "Музыка",
  "settings.title": "Настройки",
  "settings.tab.profile": "Профиль",
  "settings.tab.appearance": "Оформление",
  "settings.tab.privacy": "Конфиденциальность",
  "settings.tab.notifications": "Уведомления",
  "settings.tab.language": "Язык",
  "settings.language.hint": "Язык интерфейса приложения (не зависит от языка в профиле).",
  "settings.privacy.visibility": "Кто видит профиль и посты",
  "settings.privacy.public": "Все пользователи",
  "settings.privacy.friends": "Только друзья",
  "settings.privacy.private": "Только друзья (скрыт из поиска для остальных)",
  "settings.privacy.friendRequests": "Принимать заявки в друзья",
  "settings.privacy.save": "Сохранить конфиденциальность",
  "settings.privacy.saved": "Сохранено",
  "profile.limited.title": "Закрытый профиль",
  "profile.limited.message":
    "Этот пользователь ограничил просмотр: видны только имя и аватар. Добавьтесь в друзья, чтобы видеть больше.",
  "music.title": "Музыка",
  "music.tracks": "Треки",
  "music.albums": "Альбомы",
  "music.playlists": "Плейлисты",
  "music.upload": "Загрузить трек",
  "music.titleLabel": "Название",
  "music.artist": "Исполнитель",
  "music.cover": "Обложка",
  "music.visibility": "Видимость",
  "music.private": "Только я",
  "music.public": "Для всех",
  "music.addToAlbum": "В альбом",
  "music.addToPlaylist": "В плейлист",
  "music.createAlbum": "Новый альбом",
  "music.createPlaylist": "Новый плейлист",
  "music.delete": "Удалить",
  "music.empty": "Пока нет треков",
  "admin.verify": "Верификация (галочка)",
  "admin.userId": "ID пользователя (UUID)",
  "admin.grant": "Выдать",
  "admin.revoke": "Снять",
  "admin.done": "Готово",
  "common.save": "Сохранить",
  "common.cancel": "Отмена",
  "profile.edit": "Редактировать профиль",
  "profile.firstName": "Имя",
  "profile.lastName": "Фамилия",
  "profile.status": "Статус (о себе)",
  "profile.city": "Город",
  "profile.country": "Страна",
  "profile.language": "Язык",
  "profile.gender": "Пол",
  "profile.interests": "Интересы",
  "profile.movies": "Любимые фильмы",
  "profile.games": "Любимые игры",
  "profile.save": "Сохранить",
  "profile.notSpecified": "Не указано",
};

const enGB: Record<Key, string> = {
  "nav.feed": "Feed",
  "nav.profile": "Profile",
  "nav.friends": "Friends",
  "nav.communities": "Communities",
  "nav.messages": "Messages",
  "nav.settings": "Settings",
  "nav.music": "Music",
  "settings.title": "Settings",
  "settings.tab.profile": "Profile",
  "settings.tab.appearance": "Appearance",
  "settings.tab.privacy": "Privacy",
  "settings.tab.notifications": "Notifications",
  "settings.tab.language": "Language",
  "settings.language.hint": "App interface language (separate from profile language).",
  "settings.privacy.visibility": "Who can see your profile and posts",
  "settings.privacy.public": "Everyone",
  "settings.privacy.friends": "Friends only",
  "settings.privacy.private": "Friends only (hidden from search for others)",
  "settings.privacy.friendRequests": "Allow friend requests",
  "settings.privacy.save": "Save privacy",
  "settings.privacy.saved": "Saved",
  "profile.limited.title": "Private profile",
  "profile.limited.message":
    "This user limited their profile: only name and avatar are visible. Add them as a friend to see more.",
  "music.title": "Music",
  "music.tracks": "Tracks",
  "music.albums": "Albums",
  "music.playlists": "Playlists",
  "music.upload": "Upload track",
  "music.titleLabel": "Title",
  "music.artist": "Artist",
  "music.cover": "Cover art",
  "music.visibility": "Visibility",
  "music.private": "Only me",
  "music.public": "Public",
  "music.addToAlbum": "Add to album",
  "music.addToPlaylist": "Add to playlist",
  "music.createAlbum": "New album",
  "music.createPlaylist": "New playlist",
  "music.delete": "Delete",
  "music.empty": "No tracks yet",
  "admin.verify": "Verification badge",
  "admin.userId": "User ID (UUID)",
  "admin.grant": "Grant",
  "admin.revoke": "Revoke",
  "admin.done": "Done",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "profile.edit": "Edit profile",
  "profile.firstName": "First name",
  "profile.lastName": "Last name",
  "profile.status": "Status (about)",
  "profile.city": "City",
  "profile.country": "Country",
  "profile.language": "Language",
  "profile.gender": "Gender",
  "profile.interests": "Interests",
  "profile.movies": "Favorite movies",
  "profile.games": "Favorite games",
  "profile.save": "Save profile",
  "profile.notSpecified": "Not specified",
};

const enUS: Record<Key, string> = {
  ...enGB,
  "settings.privacy.private": "Friends only (hidden from search for everyone else)",
};

const tt: Record<Key, string> = {
  ...ru,
  "nav.feed": "Тасма",
  "nav.profile": "Профиль",
  "nav.friends": "Дуслар",
  "nav.communities": "Җәмгыятьләр",
  "nav.messages": "Хәбәрләр",
  "nav.settings": "Көйләүләр",
  "nav.music": "Музыка",
  "settings.title": "Көйләүләр",
  "settings.tab.profile": "Профиль",
  "settings.tab.appearance": "Күренеш",
  "settings.tab.privacy": "Яшеренлек",
  "settings.tab.notifications": "Белдерүләр",
  "settings.tab.language": "Тел",
  "settings.language.hint": "Кушымта интерфейсы теле (профильдәге телгә бәйле түгел).",
  "settings.privacy.visibility": "Профильны һәм постларны кем күрә",
  "settings.privacy.public": "Барлык кулланучылар",
  "settings.privacy.friends": "Дуслар гына",
  "settings.privacy.private": "Дуслар гына (башкалар өчен эзләүдә яшерелгән)",
  "settings.privacy.friendRequests": "Дуслашу тәкъдимнәрен кабул итү",
  "settings.privacy.save": "Яшеренлекне сакларга",
  "settings.privacy.saved": "Сакланды",
  "profile.limited.title": "Ябык профиль",
  "profile.limited.message": "Бу кулланучы профильне чикләде: исеме һәм аватар гына күренә. Күбрәк күрү өчен дуслар исемлегенә керегез.",
  "music.title": "Музыка",
  "music.tracks": "Треклар",
  "music.albums": "Альбомнар",
  "music.playlists": "Плейлистлар",
  "music.upload": "Трек йөкләү",
  "music.titleLabel": "Исем",
  "music.artist": "Башкаручы",
  "music.cover": "Тышлык",
  "music.visibility": "Күренүчәнлек",
  "music.private": "Миңа гына",
  "music.public": "Барсына да",
  "music.addToAlbum": "Альбомга",
  "music.addToPlaylist": "Плейлистга",
  "music.createAlbum": "Яңа альбом",
  "music.createPlaylist": "Яңа плейлист",
  "music.delete": "Бетерү",
  "music.empty": "Треклар юк әле",
  "admin.verify": "Верификация",
  "admin.userId": "Кулланучы ID (UUID)",
  "admin.grant": "Бирергә",
  "admin.revoke": "Алырга",
  "admin.done": "Әзер",
  "common.save": "Сакларга",
  "common.cancel": "Баш тарту",
  "profile.edit": "Профильны үзгәртү",
  "profile.firstName": "Исем",
  "profile.lastName": "Фамилия",
  "profile.status": "Статус (үзең турында)",
  "profile.city": "Шәһәр",
  "profile.country": "Ил",
  "profile.language": "Тел",
  "profile.gender": "Җенес",
  "profile.interests": "Кызыксынулар",
  "profile.movies": "Яраткан фильмнар",
  "profile.games": "Яраткан уеннар",
  "profile.save": "Сакларга",
  "profile.notSpecified": "Күрсәтелмәгән",
};

const ce: Record<Key, string> = {
  ...ru,
  "nav.feed": "Тасма",
  "nav.profile": "Профиль",
  "nav.friends": "Досташ",
  "nav.communities": "Йукъараллаш",
  "nav.messages": "Хаамаш",
  "nav.settings": "ГIирс",
  "nav.music": "Музыка",
  "settings.title": "ГIирс",
  "settings.tab.profile": "Профиль",
  "settings.tab.appearance": "Күренеш",
  "settings.tab.privacy": "Яшеренлек",
  "settings.tab.notifications": "Хаамаш",
  "settings.tab.language": "Меттиг",
  "common.save": "Iалашдан",
  "common.cancel": "Йухадаккха",
};

const hy: Record<Key, string> = {
  ...enGB,
  "nav.feed": "Լրահոս",
  "nav.profile": "Պրոֆիլ",
  "nav.friends": "Ընկերներ",
  "nav.communities": "Համայնքներ",
  "nav.messages": "Հաղորդագրություններ",
  "nav.settings": "Կարգավորումներ",
  "nav.music": "Երաժշտություն",
  "music.title": "Երաժշտություն",
  "settings.title": "Կարգավորումներ",
  "common.save": "Պահպանել",
  "common.cancel": "Չեղարկել",
  "profile.edit": "Խմբագրել պրոֆիլը",
};

const tr: Record<Key, string> = {
  ...enGB,
  "nav.feed": "Akış",
  "nav.profile": "Profil",
  "nav.friends": "Arkadaşlar",
  "nav.communities": "Topluluklar",
  "nav.messages": "Mesajlar",
  "nav.settings": "Ayarlar",
  "nav.music": "Müzik",
  "music.title": "Müzik",
  "music.tracks": "Parçalar",
  "music.albums": "Albümler",
  "music.playlists": "Çalma Listeleri",
  "music.upload": "Parça Yükle",
  "settings.title": "Ayarlar",
  "settings.tab.profile": "Profil",
  "settings.tab.appearance": "Görünüm",
  "settings.tab.privacy": "Gizlilik",
  "settings.tab.notifications": "Bildirimler",
  "settings.tab.language": "Dil",
  "common.save": "Kaydet",
  "common.cancel": "İptal",
  "profile.edit": "Profili Düzenle",
  "profile.firstName": "Ad",
  "profile.lastName": "Soyad",
};

const de: Record<Key, string> = {
  ...enGB,
  "nav.feed": "Feed",
  "nav.profile": "Profil",
  "nav.friends": "Freunde",
  "nav.communities": "Communities",
  "nav.messages": "Nachrichten",
  "nav.settings": "Einstellungen",
  "nav.music": "Musik",
  "music.title": "Musik",
  "music.tracks": "Titel",
  "music.albums": "Alben",
  "music.playlists": "Playlists",
  "music.upload": "Titel hochladen",
  "settings.title": "Einstellungen",
  "settings.tab.profile": "Profil",
  "settings.tab.appearance": "Aussehen",
  "settings.tab.privacy": "Privatsphäre",
  "settings.tab.notifications": "Benachrichtigungen",
  "settings.tab.language": "Sprache",
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "profile.edit": "Profil bearbeiten",
  "profile.firstName": "Vorname",
  "profile.lastName": "Nachname",
};

export const TRANSLATIONS: Record<AppLocale, Record<Key, string>> = {
  ru,
  "en-GB": enGB,
  "en-US": enUS,
  tt,
  ce,
  hy,
  tr,
  de,
};

export function translate(locale: AppLocale, key: Key): string {
  const direct = TRANSLATIONS[locale]?.[key];
  if (direct) return direct;
  const gb = TRANSLATIONS["en-GB"]?.[key];
  if (gb) return gb;
  return TRANSLATIONS.ru[key] ?? key;
}
