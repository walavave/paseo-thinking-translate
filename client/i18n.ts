import { useSyncExternalStore } from "react";
import type { FailureCode } from "../shared/contract";
import { resolveLocale, systemLocales, type Locale } from "../shared/locale";

export interface Messages {
  settingsTitle: string;
  settingsInfo: string;
  autoTranslate: string;
  service: string;
  serviceFree: string;
  serviceGoogle: string;
  serviceMicrosoft: string;
  targetLanguage: string;
  targetLanguageHint: string;
  customLanguage: string;
  customLanguageHint: string;
  errorTargetLanguage: string;
  endpoint: string;
  freeEndpointHint: string;
  googleVersion: string;
  googleV2: string;
  googleV3: string;
  googleApiKey: string;
  googleApiKeyHint: string;
  googleToken: string;
  googleTokenHint: string;
  googleProject: string;
  googleEndpoint: string;
  googleEndpointHint: string;
  microsoftKey: string;
  microsoftKeyHint: string;
  microsoftRegion: string;
  microsoftRegionHint: string;
  microsoftEndpoint: string;
  microsoftEndpointHint: string;
  hostSettings: string;
  save: string;
  saving: string;
  reload: string;
  reloadAction: string;
  saved: string;
  loading: string;
  readFailed: string;
  retry: string;
  reset: string;
  restoreDefaults: string;
  errorGoogleKey: string;
  errorGoogleToken: string;
  errorGoogleProject: string;
  errorMicrosoftKey: string;
  errorEndpoint: string;
  errorInvalid: string;
  original: string;
  showOriginal: string;
  showLanguage: string;
  translatingTo: string;
  autoDisabled: string;
  retryTranslation: string;
  failuresSuffix: string;
  connectionFailed: string;
  invalidSettings: string;
  openLinkFailed: string;
  codeBlock: string;
  table: string;
  listSeparator: string;
  failures: Record<FailureCode, string>;
}

const en: Messages = {
  settingsTitle: "Thinking Translation",
  settingsInfo:
    "Thinking text is sent from the daemon to the selected service. The keyless Google endpoint may rate-limit; keys are stored as plain text in the daemon settings file (mode 0600).",
  autoTranslate: "Translate automatically",
  service: "Translation service",
  serviceFree: "Google keyless endpoint",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "Target language",
  targetLanguageHint: "Use zh-CN / zh-TW for Google; Microsoft maps them to zh-Hans / zh-Hant.",
  customLanguage: "Other language…",
  customLanguageHint: "Enter a Google or Microsoft language code, e.g. sr-Latn.",
  errorTargetLanguage: "Enter a valid language code.",
  endpoint: "Endpoint",
  freeEndpointHint: "Keyless endpoint returning Google translate_a/t JSON.",
  googleVersion: "Google API version",
  googleV2: "v2 (API key)",
  googleV3: "v3 (OAuth access token)",
  googleApiKey: "Google API key",
  googleApiKeyHint: "Create one after enabling the Cloud Translation API in Google Cloud Console.",
  googleToken: "OAuth access token",
  googleTokenHint:
    "v3 does not accept API keys; tokens expire after about an hour and must be refreshed.",
  googleProject: "Google Cloud project ID",
  googleEndpoint: "Google API endpoint",
  googleEndpointHint:
    "Base URL, defaults to https://translation.googleapis.com; the version path is appended.",
  microsoftKey: "Microsoft API key",
  microsoftKeyHint: "Key for your Azure Translator resource.",
  microsoftRegion: "Microsoft region",
  microsoftRegionHint:
    "Set the region for regional resources, e.g. eastasia; leave blank for global resources.",
  microsoftEndpoint: "Microsoft endpoint",
  microsoftEndpointHint: "Defaults to https://api.cognitive.microsofttranslator.com.",
  hostSettings: "Host-level settings",
  save: "Save",
  saving: "Saving…",
  reload: "Reload settings and discard draft",
  reloadAction: "Reload",
  saved: "Settings saved",
  loading: "Loading settings…",
  readFailed: "Failed to load",
  retry: "Retry",
  reset: "Reset",
  restoreDefaults: "Restore defaults",
  errorGoogleKey: "Google Cloud v2 requires an API key.",
  errorGoogleToken: "Google Cloud v3 requires an OAuth access token.",
  errorGoogleProject: "Google Cloud v3 requires a project ID.",
  errorMicrosoftKey: "Microsoft Translator requires an API key.",
  errorEndpoint: "Enter a valid target language and HTTP(S) endpoint.",
  errorInvalid: "Invalid settings.",
  original: "Original",
  showOriginal: "Show original",
  showLanguage: "Show {language}",
  translatingTo: "Translating to {language}…",
  autoDisabled: "Automatic translation is off",
  retryTranslation: "Retry translation",
  failuresSuffix: "; failed parts show the original.",
  connectionFailed: "Translation connection failed",
  invalidSettings: "Could not read translation settings: ",
  openLinkFailed: "Could not open link: ",
  codeBlock: "Code block",
  table: "Table",
  listSeparator: "; ",
  failures: {
    network: "Network error",
    timeout: "Request timed out",
    rate_limit: "Rate limited",
    auth: "Invalid key or permission denied",
    http: "Service returned an error",
    invalid_response: "Unexpected response format",
    config: "Translation settings are incomplete",
    disposed: "Translation cancelled",
    disabled: "Automatic translation is off",
  },
};

const zhCN: Messages = {
  settingsTitle: "Thinking 翻译",
  settingsInfo:
    "思考文本由 daemon 发送至所选翻译服务。Google 免 key 接口可能限流；密钥明文保存在 daemon 设置文件中（权限 0600）。",
  autoTranslate: "自动翻译",
  service: "翻译服务",
  serviceFree: "Google 免费接口",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "微软翻译",
  targetLanguage: "目标语言",
  targetLanguageHint: "Google 使用 zh-CN / zh-TW；微软会自动转换为 zh-Hans / zh-Hant。",
  customLanguage: "其他语言…",
  customLanguageHint: "输入 Google 或微软的语言代码，例如 sr-Latn。",
  errorTargetLanguage: "请输入有效的语言代码。",
  endpoint: "Endpoint",
  freeEndpointHint: "免 key 接口，返回 Google translate_a/t 的 JSON 结构。",
  googleVersion: "Google API 版本",
  googleV2: "v2（API Key）",
  googleV3: "v3（OAuth Access Token）",
  googleApiKey: "Google API Key",
  googleApiKeyHint: "在 Google Cloud Console 启用 Cloud Translation API 后创建。",
  googleToken: "OAuth Access Token",
  googleTokenHint: "v3 不支持 API Key；令牌约 1 小时后过期，需要定期更新。",
  googleProject: "Google Cloud 项目 ID",
  googleEndpoint: "Google API Endpoint",
  googleEndpointHint: "基础地址，默认 https://translation.googleapis.com；版本路径由插件拼接。",
  microsoftKey: "微软 API Key",
  microsoftKeyHint: "Azure 翻译资源的密钥。",
  microsoftRegion: "微软区域",
  microsoftRegionHint: "多区域资源填区域，例如 eastasia；全局资源可留空。",
  microsoftEndpoint: "微软 Endpoint",
  microsoftEndpointHint: "默认 https://api.cognitive.microsofttranslator.com。",
  hostSettings: "宿主级设置",
  save: "保存",
  saving: "保存中…",
  reload: "重新读取设置并放弃草稿",
  reloadAction: "重新读取",
  saved: "设置已保存",
  loading: "正在读取设置…",
  readFailed: "读取失败",
  retry: "重试",
  reset: "重置",
  restoreDefaults: "恢复默认设置",
  errorGoogleKey: "Google Cloud v2 需要 API Key。",
  errorGoogleToken: "Google Cloud v3 需要 OAuth Access Token。",
  errorGoogleProject: "Google Cloud v3 需要项目 ID。",
  errorMicrosoftKey: "微软翻译需要 API Key。",
  errorEndpoint: "请填写有效的目标语言和 HTTP(S) endpoint。",
  errorInvalid: "设置无效。",
  original: "原文",
  showOriginal: "显示原文",
  showLanguage: "显示{language}",
  translatingTo: "正在翻译为{language}…",
  autoDisabled: "自动翻译已关闭",
  retryTranslation: "重试翻译",
  failuresSuffix: "，失败部分显示原文。",
  connectionFailed: "翻译连接失败",
  invalidSettings: "无法读取翻译设置：",
  openLinkFailed: "无法打开链接：",
  codeBlock: "代码块",
  table: "表格",
  listSeparator: "；",
  failures: {
    network: "网络错误",
    timeout: "请求超时",
    rate_limit: "请求被限流",
    auth: "密钥无效或无权限",
    http: "服务返回错误",
    invalid_response: "服务响应格式异常",
    config: "翻译设置不完整",
    disposed: "翻译已取消",
    disabled: "自动翻译已关闭",
  },
};

const ja: Messages = {
  settingsTitle: "Thinking 翻訳",
  settingsInfo:
    "思考テキストは daemon から選択したサービスへ送信されます。キー不要の Google エンドポイントはレート制限される場合があります。キーは daemon の設定ファイルに平文で保存されます（権限 0600）。",
  autoTranslate: "自動翻訳",
  service: "翻訳サービス",
  serviceFree: "Google キー不要エンドポイント",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "対象言語",
  targetLanguageHint:
    "Google では zh-CN / zh-TW を使用します。Microsoft では zh-Hans / zh-Hant に自動変換されます。",
  customLanguage: "その他の言語…",
  customLanguageHint: "Google または Microsoft の言語コードを入力（例: sr-Latn）。",
  errorTargetLanguage: "有効な言語コードを入力してください。",
  endpoint: "エンドポイント",
  freeEndpointHint: "Google translate_a/t の JSON を返すキー不要エンドポイント。",
  googleVersion: "Google API バージョン",
  googleV2: "v2（API キー）",
  googleV3: "v3（OAuth アクセストークン）",
  googleApiKey: "Google API キー",
  googleApiKeyHint: "Google Cloud Console で Cloud Translation API を有効にしてから作成します。",
  googleToken: "OAuth アクセストークン",
  googleTokenHint: "v3 は API キー非対応です。トークンは約 1 時間で失効するため更新が必要です。",
  googleProject: "Google Cloud プロジェクト ID",
  googleEndpoint: "Google API エンドポイント",
  googleEndpointHint:
    "ベース URL（既定: https://translation.googleapis.com）。バージョンパスはプラグインが付加します。",
  microsoftKey: "Microsoft API キー",
  microsoftKeyHint: "Azure Translator リソースのキー。",
  microsoftRegion: "Microsoft リージョン",
  microsoftRegionHint:
    "リージョンリソースでは eastasia などを指定。グローバルリソースは空欄にします。",
  microsoftEndpoint: "Microsoft エンドポイント",
  microsoftEndpointHint: "既定: https://api.cognitive.microsofttranslator.com。",
  hostSettings: "ホスト設定",
  save: "保存",
  saving: "保存中…",
  reload: "設定を再読み込みして下書きを破棄",
  reloadAction: "再読み込み",
  saved: "設定を保存しました",
  loading: "設定を読み込み中…",
  readFailed: "読み込み失敗",
  retry: "再試行",
  reset: "リセット",
  restoreDefaults: "既定に戻す",
  errorGoogleKey: "Google Cloud v2 には API キーが必要です。",
  errorGoogleToken: "Google Cloud v3 には OAuth アクセストークンが必要です。",
  errorGoogleProject: "Google Cloud v3 にはプロジェクト ID が必要です。",
  errorMicrosoftKey: "Microsoft Translator には API キーが必要です。",
  errorEndpoint: "有効な対象言語と HTTP(S) エンドポイントを入力してください。",
  errorInvalid: "設定が無効です。",
  original: "原文",
  showOriginal: "原文を表示",
  showLanguage: "{language}を表示",
  translatingTo: "{language}に翻訳中…",
  autoDisabled: "自動翻訳はオフです",
  retryTranslation: "翻訳を再試行",
  failuresSuffix: "。失敗した部分は原文を表示します。",
  connectionFailed: "翻訳に接続できません",
  invalidSettings: "翻訳設定を読み込めません：",
  openLinkFailed: "リンクを開けません：",
  codeBlock: "コードブロック",
  table: "表",
  listSeparator: "；",
  failures: {
    network: "ネットワークエラー",
    timeout: "リクエストがタイムアウトしました",
    rate_limit: "レート制限中",
    auth: "キーが無効か権限がありません",
    http: "サービスがエラーを返しました",
    invalid_response: "応答形式が不正です",
    config: "翻訳設定が不完全です",
    disposed: "翻訳はキャンセルされました",
    disabled: "自動翻訳はオフです",
  },
};

const ko: Messages = {
  settingsTitle: "Thinking 번역",
  settingsInfo:
    "사고 텍스트는 daemon에서 선택한 서비스로 전송됩니다. 키가 필요 없는 Google 엔드포인트는 속도 제한될 수 있으며, 키는 daemon 설정 파일에 평문으로 저장됩니다(권한 0600).",
  autoTranslate: "자동 번역",
  service: "번역 서비스",
  serviceFree: "Google 키 불필요 엔드포인트",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "대상 언어",
  targetLanguageHint:
    "Google은 zh-CN / zh-TW를 사용하며 Microsoft는 zh-Hans / zh-Hant로 자동 변환합니다.",
  customLanguage: "기타 언어…",
  customLanguageHint: "Google 또는 Microsoft 언어 코드를 입력하세요(예: sr-Latn).",
  errorTargetLanguage: "유효한 언어 코드를 입력하세요.",
  endpoint: "엔드포인트",
  freeEndpointHint: "Google translate_a/t JSON을 반환하는 키 불필요 엔드포인트.",
  googleVersion: "Google API 버전",
  googleV2: "v2(API 키)",
  googleV3: "v3(OAuth 액세스 토큰)",
  googleApiKey: "Google API 키",
  googleApiKeyHint: "Google Cloud Console에서 Cloud Translation API를 활성화한 후 생성하세요.",
  googleToken: "OAuth 액세스 토큰",
  googleTokenHint:
    "v3는 API 키를 지원하지 않습니다. 토큰은 약 1시간 후 만료되므로 갱신해야 합니다.",
  googleProject: "Google Cloud 프로젝트 ID",
  googleEndpoint: "Google API 엔드포인트",
  googleEndpointHint:
    "기본 URL은 https://translation.googleapis.com이며 버전 경로는 플러그인이 추가합니다.",
  microsoftKey: "Microsoft API 키",
  microsoftKeyHint: "Azure Translator 리소스의 키.",
  microsoftRegion: "Microsoft 지역",
  microsoftRegionHint: "지역 리소스는 eastasia처럼 지정하고, 전역 리소스는 비워 두세요.",
  microsoftEndpoint: "Microsoft 엔드포인트",
  microsoftEndpointHint: "기본값 https://api.cognitive.microsofttranslator.com.",
  hostSettings: "호스트 설정",
  save: "저장",
  saving: "저장 중…",
  reload: "설정을 다시 읽고 초안 버리기",
  reloadAction: "다시 읽기",
  saved: "설정이 저장되었습니다",
  loading: "설정을 불러오는 중…",
  readFailed: "불러오기 실패",
  retry: "재시도",
  reset: "초기화",
  restoreDefaults: "기본값 복원",
  errorGoogleKey: "Google Cloud v2에는 API 키가 필요합니다.",
  errorGoogleToken: "Google Cloud v3에는 OAuth 액세스 토큰이 필요합니다.",
  errorGoogleProject: "Google Cloud v3에는 프로젝트 ID가 필요합니다.",
  errorMicrosoftKey: "Microsoft Translator에는 API 키가 필요합니다.",
  errorEndpoint: "유효한 대상 언어와 HTTP(S) 엔드포인트를 입력하세요.",
  errorInvalid: "설정이 올바르지 않습니다.",
  original: "원문",
  showOriginal: "원문 보기",
  showLanguage: "{language} 보기",
  translatingTo: "{language}로 번역 중…",
  autoDisabled: "자동 번역이 꺼져 있습니다",
  retryTranslation: "번역 재시도",
  failuresSuffix: ". 실패한 부분은 원문을 표시합니다.",
  connectionFailed: "번역 서비스에 연결하지 못했습니다",
  invalidSettings: "번역 설정을 읽을 수 없습니다: ",
  openLinkFailed: "링크를 열 수 없습니다: ",
  codeBlock: "코드 블록",
  table: "표",
  listSeparator: "; ",
  failures: {
    network: "네트워크 오류",
    timeout: "요청 시간 초과",
    rate_limit: "요청이 제한되었습니다",
    auth: "키가 잘못되었거나 권한이 없습니다",
    http: "서비스가 오류를 반환했습니다",
    invalid_response: "응답 형식이 올바르지 않습니다",
    config: "번역 설정이 불완전합니다",
    disposed: "번역이 취소되었습니다",
    disabled: "자동 번역이 꺼져 있습니다",
  },
};

const fr: Messages = {
  settingsTitle: "Traduction de Thinking",
  settingsInfo:
    "Le texte de raisonnement est envoyé par le daemon au service choisi. L’endpoint Google sans clé peut limiter les requêtes ; les clés sont stockées en clair dans le fichier de réglages du daemon (mode 0600).",
  autoTranslate: "Traduire automatiquement",
  service: "Service de traduction",
  serviceFree: "Endpoint Google sans clé",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "Langue cible",
  targetLanguageHint:
    "Utilisez zh-CN / zh-TW avec Google ; Microsoft les convertit en zh-Hans / zh-Hant.",
  customLanguage: "Autre langue…",
  customLanguageHint: "Saisissez un code de langue Google ou Microsoft, par ex. sr-Latn.",
  errorTargetLanguage: "Saisissez un code de langue valide.",
  endpoint: "Endpoint",
  freeEndpointHint: "Endpoint sans clé renvoyant le JSON Google translate_a/t.",
  googleVersion: "Version de l’API Google",
  googleV2: "v2 (clé API)",
  googleV3: "v3 (jeton d’accès OAuth)",
  googleApiKey: "Clé API Google",
  googleApiKeyHint: "À créer après avoir activé Cloud Translation API dans Google Cloud Console.",
  googleToken: "Jeton d’accès OAuth",
  googleTokenHint:
    "v3 n’accepte pas les clés API ; le jeton expire après environ une heure et doit être renouvelé.",
  googleProject: "ID du projet Google Cloud",
  googleEndpoint: "Endpoint de l’API Google",
  googleEndpointHint:
    "URL de base, par défaut https://translation.googleapis.com ; le chemin de version est ajouté.",
  microsoftKey: "Clé API Microsoft",
  microsoftKeyHint: "Clé de votre ressource Azure Translator.",
  microsoftRegion: "Région Microsoft",
  microsoftRegionHint:
    "Indiquez la région des ressources régionales, par ex. eastasia ; laissez vide pour les ressources globales.",
  microsoftEndpoint: "Endpoint Microsoft",
  microsoftEndpointHint: "Par défaut https://api.cognitive.microsofttranslator.com.",
  hostSettings: "Réglages de l’hôte",
  save: "Enregistrer",
  saving: "Enregistrement…",
  reload: "Recharger les réglages et abandonner le brouillon",
  reloadAction: "Recharger",
  saved: "Réglages enregistrés",
  loading: "Chargement des réglages…",
  readFailed: "Échec du chargement",
  retry: "Réessayer",
  reset: "Réinitialiser",
  restoreDefaults: "Rétablir les valeurs par défaut",
  errorGoogleKey: "Google Cloud v2 nécessite une clé API.",
  errorGoogleToken: "Google Cloud v3 nécessite un jeton d’accès OAuth.",
  errorGoogleProject: "Google Cloud v3 nécessite un ID de projet.",
  errorMicrosoftKey: "Microsoft Translator nécessite une clé API.",
  errorEndpoint: "Saisissez une langue cible et un endpoint HTTP(S) valides.",
  errorInvalid: "Réglages invalides.",
  original: "Original",
  showOriginal: "Afficher l’original",
  showLanguage: "Afficher : {language}",
  translatingTo: "Traduction vers {language}…",
  autoDisabled: "La traduction automatique est désactivée",
  retryTranslation: "Réessayer la traduction",
  failuresSuffix: " ; les parties en échec affichent l’original.",
  connectionFailed: "Connexion à la traduction impossible",
  invalidSettings: "Impossible de lire les réglages de traduction : ",
  openLinkFailed: "Impossible d’ouvrir le lien : ",
  codeBlock: "Bloc de code",
  table: "Tableau",
  listSeparator: " ; ",
  failures: {
    network: "Erreur réseau",
    timeout: "Délai de requête dépassé",
    rate_limit: "Requêtes limitées",
    auth: "Clé invalide ou accès refusé",
    http: "Le service a renvoyé une erreur",
    invalid_response: "Format de réponse inattendu",
    config: "Réglages de traduction incomplets",
    disposed: "Traduction annulée",
    disabled: "La traduction automatique est désactivée",
  },
};

const es: Messages = {
  settingsTitle: "Traducción de Thinking",
  settingsInfo:
    "El daemon envía el texto del razonamiento al servicio elegido. El endpoint de Google sin clave puede limitar solicitudes; las claves se guardan en texto plano en el archivo de ajustes del daemon (permisos 0600).",
  autoTranslate: "Traducir automáticamente",
  service: "Servicio de traducción",
  serviceFree: "Endpoint de Google sin clave",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "Idioma de destino",
  targetLanguageHint: "Usa zh-CN / zh-TW con Google; Microsoft los convierte a zh-Hans / zh-Hant.",
  customLanguage: "Otro idioma…",
  customLanguageHint: "Introduce un código de idioma de Google o Microsoft, p. ej. sr-Latn.",
  errorTargetLanguage: "Introduce un código de idioma válido.",
  endpoint: "Endpoint",
  freeEndpointHint: "Endpoint sin clave que devuelve JSON de Google translate_a/t.",
  googleVersion: "Versión de la API de Google",
  googleV2: "v2 (clave de API)",
  googleV3: "v3 (token de acceso OAuth)",
  googleApiKey: "Clave de API de Google",
  googleApiKeyHint: "Créala tras activar Cloud Translation API en Google Cloud Console.",
  googleToken: "Token de acceso OAuth",
  googleTokenHint:
    "v3 no acepta claves de API; el token caduca en aproximadamente una hora y debe renovarse.",
  googleProject: "ID del proyecto de Google Cloud",
  googleEndpoint: "Endpoint de la API de Google",
  googleEndpointHint:
    "URL base, por defecto https://translation.googleapis.com; la ruta de versión la añade el plugin.",
  microsoftKey: "Clave de API de Microsoft",
  microsoftKeyHint: "Clave de tu recurso de Azure Translator.",
  microsoftRegion: "Región de Microsoft",
  microsoftRegionHint:
    "Indica la región de los recursos regionales, p. ej. eastasia; déjalo vacío para recursos globales.",
  microsoftEndpoint: "Endpoint de Microsoft",
  microsoftEndpointHint: "Por defecto https://api.cognitive.microsofttranslator.com.",
  hostSettings: "Ajustes del host",
  save: "Guardar",
  saving: "Guardando…",
  reload: "Recargar ajustes y descartar borrador",
  reloadAction: "Recargar",
  saved: "Ajustes guardados",
  loading: "Cargando ajustes…",
  readFailed: "Error al cargar",
  retry: "Reintentar",
  reset: "Restablecer",
  restoreDefaults: "Restaurar valores predeterminados",
  errorGoogleKey: "Google Cloud v2 requiere una clave de API.",
  errorGoogleToken: "Google Cloud v3 requiere un token de acceso OAuth.",
  errorGoogleProject: "Google Cloud v3 requiere un ID de proyecto.",
  errorMicrosoftKey: "Microsoft Translator requiere una clave de API.",
  errorEndpoint: "Introduce un idioma de destino y un endpoint HTTP(S) válidos.",
  errorInvalid: "Ajustes no válidos.",
  original: "Original",
  showOriginal: "Mostrar original",
  showLanguage: "Mostrar {language}",
  translatingTo: "Traduciendo a {language}…",
  autoDisabled: "La traducción automática está desactivada",
  retryTranslation: "Reintentar traducción",
  failuresSuffix: "; las partes fallidas muestran el original.",
  connectionFailed: "No se pudo conectar con la traducción",
  invalidSettings: "No se pudieron leer los ajustes de traducción: ",
  openLinkFailed: "No se pudo abrir el enlace: ",
  codeBlock: "Bloque de código",
  table: "Tabla",
  listSeparator: "; ",
  failures: {
    network: "Error de red",
    timeout: "Se agotó el tiempo de espera",
    rate_limit: "Solicitudes limitadas",
    auth: "Clave no válida o sin permiso",
    http: "El servicio devolvió un error",
    invalid_response: "Formato de respuesta inesperado",
    config: "Ajustes de traducción incompletos",
    disposed: "Traducción cancelada",
    disabled: "La traducción automática está desactivada",
  },
};

const ptBR: Messages = {
  settingsTitle: "Tradução de Thinking",
  settingsInfo:
    "O texto de raciocínio é enviado pelo daemon ao serviço escolhido. O endpoint do Google sem chave pode limitar solicitações; as chaves são salvas em texto simples no arquivo de configurações do daemon (permissão 0600).",
  autoTranslate: "Traduzir automaticamente",
  service: "Serviço de tradução",
  serviceFree: "Endpoint do Google sem chave",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "Idioma de destino",
  targetLanguageHint:
    "Use zh-CN / zh-TW no Google; o Microsoft os converte para zh-Hans / zh-Hant.",
  customLanguage: "Outro idioma…",
  customLanguageHint: "Informe um código de idioma do Google ou Microsoft, por exemplo sr-Latn.",
  errorTargetLanguage: "Informe um código de idioma válido.",
  endpoint: "Endpoint",
  freeEndpointHint: "Endpoint sem chave que retorna JSON do Google translate_a/t.",
  googleVersion: "Versão da API do Google",
  googleV2: "v2 (chave de API)",
  googleV3: "v3 (token de acesso OAuth)",
  googleApiKey: "Chave de API do Google",
  googleApiKeyHint: "Crie uma após ativar a Cloud Translation API no Google Cloud Console.",
  googleToken: "Token de acesso OAuth",
  googleTokenHint:
    "A v3 não aceita chaves de API; o token expira em cerca de uma hora e precisa ser renovado.",
  googleProject: "ID do projeto do Google Cloud",
  googleEndpoint: "Endpoint da API do Google",
  googleEndpointHint:
    "URL base, padrão https://translation.googleapis.com; o plugin acrescenta o caminho da versão.",
  microsoftKey: "Chave de API da Microsoft",
  microsoftKeyHint: "Chave do seu recurso Azure Translator.",
  microsoftRegion: "Região da Microsoft",
  microsoftRegionHint:
    "Informe a região para recursos regionais, por exemplo eastasia; deixe vazio para recursos globais.",
  microsoftEndpoint: "Endpoint da Microsoft",
  microsoftEndpointHint: "Padrão https://api.cognitive.microsofttranslator.com.",
  hostSettings: "Configurações do host",
  save: "Salvar",
  saving: "Salvando…",
  reload: "Recarregar configurações e descartar rascunho",
  reloadAction: "Recarregar",
  saved: "Configurações salvas",
  loading: "Carregando configurações…",
  readFailed: "Falha ao carregar",
  retry: "Tentar novamente",
  reset: "Redefinir",
  restoreDefaults: "Restaurar padrões",
  errorGoogleKey: "O Google Cloud v2 exige uma chave de API.",
  errorGoogleToken: "O Google Cloud v3 exige um token de acesso OAuth.",
  errorGoogleProject: "O Google Cloud v3 exige um ID de projeto.",
  errorMicrosoftKey: "O Microsoft Translator exige uma chave de API.",
  errorEndpoint: "Informe um idioma de destino e um endpoint HTTP(S) válidos.",
  errorInvalid: "Configurações inválidas.",
  original: "Original",
  showOriginal: "Mostrar original",
  showLanguage: "Mostrar {language}",
  translatingTo: "Traduzindo para {language}…",
  autoDisabled: "A tradução automática está desativada",
  retryTranslation: "Tentar traduzir novamente",
  failuresSuffix: "; as partes com falha mostram o original.",
  connectionFailed: "Falha ao conectar com a tradução",
  invalidSettings: "Não foi possível ler as configurações de tradução: ",
  openLinkFailed: "Não foi possível abrir o link: ",
  codeBlock: "Bloco de código",
  table: "Tabela",
  listSeparator: "; ",
  failures: {
    network: "Erro de rede",
    timeout: "Tempo limite esgotado",
    rate_limit: "Solicitações limitadas",
    auth: "Chave inválida ou sem permissão",
    http: "O serviço retornou um erro",
    invalid_response: "Formato de resposta inesperado",
    config: "Configurações de tradução incompletas",
    disposed: "Tradução cancelada",
    disabled: "A tradução automática está desativada",
  },
};

const ru: Messages = {
  settingsTitle: "Перевод Thinking",
  settingsInfo:
    "Текст рассуждений отправляется из daemon в выбранный сервис. Бесплатный endpoint Google без ключа может ограничивать запросы; ключи хранятся в открытом виде в файле настроек daemon (права 0600).",
  autoTranslate: "Переводить автоматически",
  service: "Сервис перевода",
  serviceFree: "Endpoint Google без ключа",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "Целевой язык",
  targetLanguageHint:
    "Для Google используйте zh-CN / zh-TW; Microsoft преобразует их в zh-Hans / zh-Hant.",
  customLanguage: "Другой язык…",
  customLanguageHint: "Введите код языка Google или Microsoft, например sr-Latn.",
  errorTargetLanguage: "Введите допустимый код языка.",
  endpoint: "Endpoint",
  freeEndpointHint: "Endpoint без ключа, возвращающий JSON Google translate_a/t.",
  googleVersion: "Версия API Google",
  googleV2: "v2 (ключ API)",
  googleV3: "v3 (токен доступа OAuth)",
  googleApiKey: "Ключ API Google",
  googleApiKeyHint: "Создайте его после включения Cloud Translation API в Google Cloud Console.",
  googleToken: "Токен доступа OAuth",
  googleTokenHint: "v3 не принимает ключи API; токен действует около часа и требует обновления.",
  googleProject: "ID проекта Google Cloud",
  googleEndpoint: "Endpoint API Google",
  googleEndpointHint:
    "Базовый URL, по умолчанию https://translation.googleapis.com; путь версии добавляет плагин.",
  microsoftKey: "Ключ API Microsoft",
  microsoftKeyHint: "Ключ ресурса Azure Translator.",
  microsoftRegion: "Регион Microsoft",
  microsoftRegionHint:
    "Укажите регион для региональных ресурсов, например eastasia; для глобальных оставьте пустым.",
  microsoftEndpoint: "Endpoint Microsoft",
  microsoftEndpointHint: "По умолчанию https://api.cognitive.microsofttranslator.com.",
  hostSettings: "Настройки хоста",
  save: "Сохранить",
  saving: "Сохранение…",
  reload: "Перечитать настройки и отменить черновик",
  reloadAction: "Перечитать",
  saved: "Настройки сохранены",
  loading: "Загрузка настроек…",
  readFailed: "Не удалось загрузить",
  retry: "Повторить",
  reset: "Сбросить",
  restoreDefaults: "Восстановить значения по умолчанию",
  errorGoogleKey: "Для Google Cloud v2 требуется ключ API.",
  errorGoogleToken: "Для Google Cloud v3 требуется токен доступа OAuth.",
  errorGoogleProject: "Для Google Cloud v3 требуется ID проекта.",
  errorMicrosoftKey: "Для Microsoft Translator требуется ключ API.",
  errorEndpoint: "Укажите допустимый целевой язык и endpoint HTTP(S).",
  errorInvalid: "Недопустимые настройки.",
  original: "Оригинал",
  showOriginal: "Показать оригинал",
  showLanguage: "Показать: {language}",
  translatingTo: "Перевод на {language}…",
  autoDisabled: "Автоматический перевод выключен",
  retryTranslation: "Повторить перевод",
  failuresSuffix: "; для неудачных частей показан оригинал.",
  connectionFailed: "Не удалось подключиться к переводу",
  invalidSettings: "Не удалось прочитать настройки перевода: ",
  openLinkFailed: "Не удалось открыть ссылку: ",
  codeBlock: "Блок кода",
  table: "Таблица",
  listSeparator: "; ",
  failures: {
    network: "Ошибка сети",
    timeout: "Время запроса истекло",
    rate_limit: "Превышен лимит запросов",
    auth: "Неверный ключ или нет доступа",
    http: "Сервис вернул ошибку",
    invalid_response: "Неожиданный формат ответа",
    config: "Настройки перевода неполны",
    disposed: "Перевод отменён",
    disabled: "Автоматический перевод выключен",
  },
};

const ar: Messages = {
  settingsTitle: "ترجمة Thinking",
  settingsInfo:
    "يرسل الـ daemon نص التفكير إلى الخدمة المختارة. قد يحدّ endpoint Google بدون مفتاح من الطلبات؛ تُحفظ المفاتيح كنص عادي في ملف إعدادات الـ daemon (الوضع 0600).",
  autoTranslate: "ترجمة تلقائية",
  service: "خدمة الترجمة",
  serviceFree: "endpoint Google بدون مفتاح",
  serviceGoogle: "Google Cloud",
  serviceMicrosoft: "Microsoft Translator",
  targetLanguage: "اللغة الهدف",
  targetLanguageHint: "استخدم zh-CN / zh-TW مع Google؛ يحوّلها Microsoft إلى zh-Hans / zh-Hant.",
  customLanguage: "لغة أخرى…",
  customLanguageHint: "أدخل رمز لغة Google أو Microsoft، مثل sr-Latn.",
  errorTargetLanguage: "أدخل رمز لغة صالحًا.",
  endpoint: "Endpoint",
  freeEndpointHint: "endpoint بدون مفتاح يعيد JSON من Google translate_a/t.",
  googleVersion: "إصدار Google API",
  googleV2: "v2 (مفتاح API)",
  googleV3: "v3 (رمز وصول OAuth)",
  googleApiKey: "مفتاح Google API",
  googleApiKeyHint: "أنشئه بعد تفعيل Cloud Translation API في Google Cloud Console.",
  googleToken: "رمز وصول OAuth",
  googleTokenHint: "لا يقبل v3 مفاتيح API؛ تنتهي صلاحية الرمز بعد ساعة تقريبًا ويجب تحديثه.",
  googleProject: "معرّف مشروع Google Cloud",
  googleEndpoint: "endpoint Google API",
  googleEndpointHint:
    "عنوان أساسي، الافتراضي https://translation.googleapis.com؛ يضيف البرنامج مسار الإصدار.",
  microsoftKey: "مفتاح Microsoft API",
  microsoftKeyHint: "مفتاح مورد Azure Translator.",
  microsoftRegion: "منطقة Microsoft",
  microsoftRegionHint: "حدّد المنطقة للموارد الإقليمية، مثل eastasia؛ اتركه فارغًا للموارد العامة.",
  microsoftEndpoint: "endpoint Microsoft",
  microsoftEndpointHint: "الافتراضي https://api.cognitive.microsofttranslator.com.",
  hostSettings: "إعدادات المضيف",
  save: "حفظ",
  saving: "جارٍ الحفظ…",
  reload: "إعادة قراءة الإعدادات وتجاهل المسودة",
  reloadAction: "إعادة القراءة",
  saved: "تم حفظ الإعدادات",
  loading: "جارٍ تحميل الإعدادات…",
  readFailed: "تعذّر التحميل",
  retry: "إعادة المحاولة",
  reset: "إعادة تعيين",
  restoreDefaults: "استعادة الإعدادات الافتراضية",
  errorGoogleKey: "يتطلب Google Cloud v2 مفتاح API.",
  errorGoogleToken: "يتطلب Google Cloud v3 رمز وصول OAuth.",
  errorGoogleProject: "يتطلب Google Cloud v3 معرّف مشروع.",
  errorMicrosoftKey: "يتطلب Microsoft Translator مفتاح API.",
  errorEndpoint: "أدخل لغة هدف وendpoint HTTP(S) صالحين.",
  errorInvalid: "إعدادات غير صالحة.",
  original: "الأصل",
  showOriginal: "عرض الأصل",
  showLanguage: "عرض {language}",
  translatingTo: "جارٍ الترجمة إلى {language}…",
  autoDisabled: "الترجمة التلقائية متوقفة",
  retryTranslation: "إعادة محاولة الترجمة",
  failuresSuffix: "؛ تعرض الأجزاء الفاشلة النص الأصلي.",
  connectionFailed: "تعذّر الاتصال بخدمة الترجمة",
  invalidSettings: "تعذّرت قراءة إعدادات الترجمة: ",
  openLinkFailed: "تعذّر فتح الرابط: ",
  codeBlock: "كتلة تعليمات برمجية",
  table: "جدول",
  listSeparator: "؛ ",
  failures: {
    network: "خطأ في الشبكة",
    timeout: "انتهت مهلة الطلب",
    rate_limit: "تم تقييد الطلبات",
    auth: "مفتاح غير صالح أو لا توجد صلاحية",
    http: "أعادت الخدمة خطأ",
    invalid_response: "تنسيق استجابة غير متوقع",
    config: "إعدادات الترجمة غير مكتملة",
    disposed: "تم إلغاء الترجمة",
    disabled: "الترجمة التلقائية متوقفة",
  },
};

export const messages: Record<Locale, Messages> = {
  en,
  "zh-CN": zhCN,
  ja,
  ko,
  fr,
  es,
  "pt-BR": ptBR,
  ru,
  ar,
};

const APP_SETTINGS_KEY = "@paseo:app-settings";
const LEGACY_SETTINGS_KEY = "@paseo:settings";

function storedLanguage(): string | null {
  const storage = (globalThis as { localStorage?: { getItem(key: string): string | null } })
    .localStorage;
  if (!storage) return null;
  for (const key of [APP_SETTINGS_KEY, LEGACY_SETTINGS_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { language?: unknown };
      if (typeof parsed.language === "string") return parsed.language;
    } catch {
      // Ignore malformed or unavailable storage and fall back to the system locale.
    }
  }
  return null;
}

export function currentLocale(): Locale {
  return resolveLocale(storedLanguage(), systemLocales());
}

let snapshot: Locale | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function refresh(): void {
  const next = currentLocale();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function getSnapshot(): Locale {
  snapshot ??= currentLocale();
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const global = globalThis as {
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
  if (listeners.size === 1) {
    global.addEventListener?.("focus", refresh);
    global.addEventListener?.("storage", refresh);
    refresh();
    timer = setInterval(refresh, 1000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      global.removeEventListener?.("focus", refresh);
      global.removeEventListener?.("storage", refresh);
    }
  };
}

/** Re-renders when Paseo's persisted app language changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, () => "en" as Locale);
}

export function useMessages(): Messages {
  return messages[useLocale()];
}

export function formatMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
