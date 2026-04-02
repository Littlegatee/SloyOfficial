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
  | "common.cancel";

const ru: Record<Key, string> = {
  "nav.feed": "Лента",
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
};

const enUS: Record<Key, string> = {
  ...enGB,
  "settings.privacy.private": "Friends only (hidden from search for everyone else)",
};

const tt: Record<Key, string> = { ...enGB, "nav.feed": "Тасма", "nav.music": "Музыка", "music.title": "Музыка" };
const ce: Record<Key, string> = { ...enGB, "nav.feed": "Тасма", "music.title": "Музыка" };
const hy: Record<Key, string> = { ...enGB, "nav.feed": "Լեզու", "music.title": "Երաժշտություն" };
const tr: Record<Key, string> = {
  ...enGB,
  "nav.feed": "Akış",
  "nav.profile": "Profil",
  "nav.music": "Müzik",
  "music.title": "Müzik",
  "settings.title": "Ayarlar",
};
const de: Record<Key, string> = {
  ...enGB,
  "nav.feed": "Feed",
  "nav.music": "Musik",
  "music.title": "Musik",
  "settings.title": "Einstellungen",
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
