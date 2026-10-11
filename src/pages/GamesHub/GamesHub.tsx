import React, { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  TreePine, RefreshCw, Trophy, AlertTriangle, Sprout, Droplets,
  BarChart3, Activity, Gamepad2, ExternalLink, CheckCircle2, CirclePlay
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { apiService, ApiError, sanitizeUrl } from "../../services/api";
import { RouteLoader } from "../../components/common/RouteLoader";
import { EmptyState } from "../../components/ui/EmptyState";
import { VideoModal, resolveVideoSource } from "../../components/ui/VideoModal";
import type { CarbonQuestion, Game } from "../../types";
import "./GamesHub.css";

/** ثمن زراعة شجرة غاف افتراضية — نفس الرقم يظهر في النص وفي زر الزراعة. */
const TREE_COST = 40;

type LocalGameKey = "calculator" | "garden";

/**
 * أي لعبة يردّها الـ API لها تطبيق محلي داخل الصفحة؟
 * الباقي يُعرض كرابط خارجي عبر sanitizeUrl بدل زر ميت.
 */
const LOCAL_GAME_BY_ID: Record<string, LocalGameKey> = {
  "carbon-footprint": "calculator",
  "carbon-simulator": "calculator",
  "ghaf-tree-grower": "garden",
  "ghaf-garden": "garden",
};

const resolveLocalGame = (game: Game): LocalGameKey | null => {
  const direct = LOCAL_GAME_BY_ID[game.id];
  if (direct) return direct;
  const id = (game.id || "").toLowerCase();
  if (id.includes("carbon") || id.includes("footprint")) return "calculator";
  if (id.includes("ghaf") || id.includes("garden") || id.includes("tree")) return "garden";
  return null;
};

const GAME_ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  TreePine,
  Sprout,
  Droplets,
  Gamepad2,
};

const iconForGame = (game: Game, local: LocalGameKey | null): LucideIcon => {
  const named = GAME_ICONS[game.icon];
  if (named) return named;
  if (local === "calculator") return BarChart3;
  if (local === "garden") return Sprout;
  return Gamepad2;
};

/** رسالة خطأ جاهزة للعرض مهما كان نوع الاستثناء. */
const describeError = (err: unknown, language: string): string => {
  if (err instanceof ApiError) return err.localizedMessage(language);
  return language === "ar" ? "حدث خطأ غير متوقع." : "An unexpected error occurred.";
};

/**
 * الـ store قد يردّ `boolean` أو `{ ok, error }` أو `{ success, message }`.
 * نقرأ الثلاثة دفاعياً بدل افتراض شكل واحد.
 */
const interpretResult = (result: unknown): { ok: boolean; error?: string } => {
  if (typeof result === "boolean") return { ok: result };
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    const ok =
      typeof r.ok === "boolean" ? r.ok :
      typeof r.success === "boolean" ? r.success :
      false;
    const error =
      typeof r.error === "string" ? r.error :
      typeof r.message === "string" && !ok ? r.message :
      undefined;
    return error === undefined ? { ok } : { ok, error };
  }
  return { ok: false };
};

export const GamesHub: React.FC = () => {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const [activeGame, setActiveGame] = useState<LocalGameKey | null>(null);

  // اللعبة اللي فيديوها مفتوح حالياً في الـ Popup
  const [videoGame, setVideoGame] = useState<Game | null>(null);
  const closeVideo = useCallback(() => setVideoGame(null), []);
  const videoSource = videoGame ? resolveVideoSource(videoGame.videoUrl) : null;

  // ── الاشتراك في الـ store بمُحدِّدات، لا getState() داخل الـ JSX ──
  const stats = useAuthStore((s) => s.stats);
  const profileLoading = useAuthStore((s) => s.loading);
  const profileError = useAuthStore((s) => s.error);
  const loadUserProfile = useAuthStore((s) => s.loadUserProfile);
  const saveCarbonFootprint = useAuthStore((s) => s.saveCarbonFootprint);
  const plantVirtualTree = useAuthStore((s) => s.plantVirtualTree);

  // ── قائمة الألعاب من الـ API ──
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [gamesReload, setGamesReload] = useState(0);

  // ── أسئلة لعبة محاكاة البصمة الكربونية ──
  const [questions, setQuestions] = useState<CarbonQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [questionsReload, setQuestionsReload] = useState(0);

  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finalFootprint, setFinalFootprint] = useState<number | null>(null);

  // ── حالة حفظ النتيجة (بديل alert) ──
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // ── رسائل الحديقة (بديل alert) ──
  const [gardenMessage, setGardenMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setGamesLoading(true);
      setGamesError(null);
      try {
        const data = await apiService.getGames();
        if (controller.signal.aborted) return;
        setGames(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setGames([]);
        setGamesError(describeError(err, language));
      } finally {
        if (!controller.signal.aborted) setGamesLoading(false);
      }
    })();
    return () => controller.abort();
  }, [language, gamesReload]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setQuestionsLoading(true);
      setQuestionsError(null);
      try {
        const data = await apiService.getCarbonQuestions();
        if (controller.signal.aborted) return;
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setQuestions([]);
        setQuestionsError(describeError(err, language));
      } finally {
        if (!controller.signal.aborted) setQuestionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [language, questionsReload]);

  const resetGame = useCallback(() => {
    setStep(0);
    setScores([]);
    setFinalFootprint(null);
    setSaveStatus("idle");
    setSaveMessage(null);
  }, []);

  const handleAnswer = (value: number) => {
    const nextScores = [...scores, value];
    setScores(nextScores);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      // حساب البصمة الكلية بالطن كربون سنوياً
      const sum = nextScores.reduce((a, b) => a + b, 0);
      setFinalFootprint(parseFloat(sum.toFixed(1)));
    }
  };

  // يا مطور الباك: النتيجة دي بتتبعت على POST /user/carbon-footprint وبتتسجل في الـ profile
  const saveScoreToDashboard = async () => {
    // ملاحظة: بصمة 0 نتيجة صحيحة تماماً (أفضل نتيجة ممكنة) — لازم تُحفظ.
    if (finalFootprint === null) return;
    if (saveStatus === "saving") return;

    setSaveStatus("saving");
    setSaveMessage(null);
    try {
      const raw = await Promise.resolve(saveCarbonFootprint(finalFootprint));
      const { ok, error } = interpretResult(raw);
      if (ok) {
        setSaveStatus("success");
        setSaveMessage(
          ar
            ? `تم حفظ نتيجتك (${finalFootprint} طن) في لوحة تحكم الأعضاء.`
            : `Your score (${finalFootprint} tons) has been saved to your dashboard.`
        );
        return;
      }
      setSaveStatus("error");
      setSaveMessage(
        error ||
          (ar
            ? "تعذّر حفظ النتيجة. برجاء المحاولة مرة أخرى."
            : "We could not save your score. Please try again.")
      );
    } catch (err) {
      setSaveStatus("error");
      setSaveMessage(describeError(err, language));
    }
  };

  const handlePlantTree = async () => {
    setGardenMessage(null);
    try {
      const raw = await Promise.resolve(plantVirtualTree("الغاف المباركة", "Blessed Ghaf", TREE_COST));
      const { ok, error } = interpretResult(raw);
      if (ok) {
        setGardenMessage({
          tone: "success",
          text: ar
            ? "مبروك! زرعت شجرة غاف جديدة وتمت إضافتها للوحتك."
            : "Congrats! A new Ghaf tree was added to your garden.",
        });
        return;
      }
      setGardenMessage({
        tone: "error",
        text:
          error ||
          (ar
            ? `عفواً، رصيد النقاط غير كافٍ (تحتاج ${TREE_COST} نقطة). شارك في الأنشطة لجمع النقاط!`
            : `Not enough eco points (you need ${TREE_COST}). Join activities to earn more!`),
      });
    } catch (err) {
      setGardenMessage({ tone: "error", text: describeError(err, language) });
    }
  };

  const openGame = (key: LocalGameKey) => {
    setActiveGame(key);
    setGardenMessage(null);
    if (key === "calculator") resetGame();
  };

  const closeGame = () => {
    setActiveGame(null);
    setGardenMessage(null);
    resetGame();
  };

  // الحارس الذي يمنع الانهيار: السؤال الحالي قد لا يكون موجوداً إطلاقاً.
  const currentQuestion: CarbonQuestion | undefined = questions[step];
  const canPlant = stats !== null && stats.ecoPoints >= TREE_COST;

  const renderQuizBody = () => {
    if (questionsLoading) {
      return <RouteLoader label={ar ? "جارٍ تحميل الأسئلة…" : "Loading questions…"} />;
    }

    if (questionsError) {
      return (
        <div className="games-state-block" role="alert">
          <EmptyState
            type="error"
            titleAr="تعذّر تحميل أسئلة المحاكي"
            titleEn="Could not load the simulator questions"
            descriptionAr={questionsError}
            descriptionEn={questionsError}
            actionAr="إعادة المحاولة"
            actionEn="Try again"
            onAction={() => setQuestionsReload((n) => n + 1)}
          />
        </div>
      );
    }

    if (questions.length === 0 || !currentQuestion) {
      return (
        <div className="games-state-block">
          <EmptyState
            type="no-data"
            titleAr="لا توجد أسئلة متاحة حالياً"
            titleEn="No questions available yet"
            descriptionAr="لم يُضِف الفريق أسئلة للمحاكي بعد. حاول مرة أخرى بعد قليل."
            descriptionEn="The simulator has no questions yet. Please check back shortly."
            actionAr="تحديث"
            actionEn="Refresh"
            onAction={() => {
              resetGame();
              setQuestionsReload((n) => n + 1);
            }}
          />
        </div>
      );
    }

    return (
      <div className="game-questions-flow">
        <div
          className="progress-bar-steps"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={step + 1}
          aria-valuetext={ar ? `السؤال ${step + 1} من ${questions.length}` : `Question ${step + 1} of ${questions.length}`}
          aria-label={ar ? "تقدّمك في محاكي البصمة الكربونية" : "Carbon footprint simulator progress"}
        >
          <div className="step-dots-row" aria-hidden="true">
            {questions.map((_, idx) => (
              <span key={idx} className={`dot ${idx <= step ? "active" : ""}`}></span>
            ))}
          </div>
          <p className="step-label">
            {ar ? `السؤال ${step + 1} من ${questions.length}` : `Question ${step + 1} of ${questions.length}`}
          </p>
        </div>

        <h4 className="question-text" id="carbon-question-text">
          {ar ? currentQuestion.questionAr : currentQuestion.questionEn}
        </h4>

        <div className="options-selection-grid" role="group" aria-labelledby="carbon-question-text">
          {(currentQuestion.options ?? []).map((opt, oIdx) => (
            <button
              key={oIdx}
              type="button"
              onClick={() => handleAnswer(opt.value)}
              className="option-card-btn card text-center"
            >
              {ar ? opt.textAr : opt.textEn}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderGamesList = () => {
    if (gamesLoading) {
      return <RouteLoader label={ar ? "جارٍ تحميل الألعاب…" : "Loading games…"} />;
    }

    if (gamesError) {
      return (
        <div className="games-state-block" role="alert">
          <EmptyState
            type="error"
            titleAr="تعذّر تحميل الألعاب"
            titleEn="Could not load the games"
            descriptionAr={gamesError}
            descriptionEn={gamesError}
            actionAr="إعادة المحاولة"
            actionEn="Try again"
            onAction={() => setGamesReload((n) => n + 1)}
          />
        </div>
      );
    }

    if (games.length === 0) {
      return (
        <div className="games-state-block">
          <EmptyState
            type="no-data"
            titleAr="لا توجد ألعاب متاحة حالياً"
            titleEn="No games available yet"
            descriptionAr="نعمل على إضافة ألعاب مناخية جديدة. تابعنا قريباً!"
            descriptionEn="New climate games are on the way. Check back soon!"
            actionAr="تحديث"
            actionEn="Refresh"
            onAction={() => setGamesReload((n) => n + 1)}
          />
        </div>
      );
    }

    return (
      <div className="games-selection-hub-grid">
        {games.map((game) => {
          const local = resolveLocalGame(game);
          const Icon = iconForGame(game, local);
          const colorClass =
            local === "calculator" ? "calculator-color" : local === "garden" ? "garden-color" : "neutral-color";
          const href = sanitizeUrl(game.playUrl || "");
          const linkable = href !== "" && href !== "#invalid-url";
          const rawVideoHref = sanitizeUrl(game.videoUrl || "");
          const videoHref = rawVideoHref !== "" && rawVideoHref !== "#invalid-url" ? rawVideoHref : null;

          return (
            <div key={game.id} className="game-selector-card card text-center">
              <span className={`game-large-icon-wrapper ${colorClass}`} aria-hidden="true">
                <Icon size={32} />
              </span>
              <h3>{ar ? game.titleAr : game.titleEn}</h3>
              {(ar ? game.descriptionAr : game.descriptionEn) && <p>{ar ? game.descriptionAr : game.descriptionEn}</p>}

              {/* فيديو اللعبة: Popup لو الرابط ينفع يتعرض جوه الصفحة، غير كده رابط خارجي */}
              {resolveVideoSource(game.videoUrl) ? (
                <button
                  type="button"
                  className="btn btn-ghost game-video-btn"
                  onClick={() => setVideoGame(game)}
                >
                  <CirclePlay size={16} aria-hidden="true" />
                  <span>{ar ? "شاهد فيديو اللعبة" : "Watch Game Video"}</span>
                </button>
              ) : videoHref ? (
                <a
                  href={videoHref}
                  className="btn btn-ghost game-video-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CirclePlay size={16} aria-hidden="true" />
                  <span>{ar ? "شاهد فيديو اللعبة" : "Watch Game Video"}</span>
                  <span className="sr-only">{ar ? "(يفتح في نافذة جديدة)" : "(opens in a new tab)"}</span>
                </a>
              ) : null}

              {local ? (
                <button type="button" onClick={() => openGame(local)} className="btn btn-primary">
                  {local === "calculator"
                    ? ar ? "ابدأ اللعب الآن" : "Play Simulator"
                    : ar ? "افتح حديقتك" : "Open Digital Garden"}
                </button>
              ) : linkable ? (
                <a
                  href={href}
                  className="btn btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{ar ? "افتح اللعبة" : "Play Game"}</span>
                  <ExternalLink size={16} aria-hidden="true" />
                  <span className="sr-only">{ar ? "(يفتح في نافذة جديدة)" : "(opens in a new tab)"}</span>
                </a>
              ) : (
                <p className="game-unavailable-note" role="note">
                  {ar
                    ? "اللعبة غير متاحة للعب عبر الموقع حالياً."
                    : "This game is not playable on the website yet."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderGarden = () => (
    <div className="garden-game-box card">
      <div className="game-box-header">
        <button type="button" onClick={closeGame} className="btn btn-ghost btn-sm">
          {ar ? "← الرجوع للألعاب" : "← Back to Games"}
        </button>
        <h3>
          <Sprout size={20} aria-hidden="true" />{" "}
          {ar ? "حديقتك الرقمية لزراعة شجرة الغاف" : "Ghaf Tree Virtual Garden"}
        </h3>
      </div>

      <div className="garden-simulator-panel text-center">
        <TreePine size={72} className="animated-tree-growing" aria-hidden="true" />

        {stats === null ? (
          <div className="games-state-block">
            <EmptyState
              type="no-data"
              titleAr="لم نُحمّل بيانات حديقتك بعد"
              titleEn="Your garden data isn't loaded yet"
              descriptionAr={
                profileError ||
                "سجّل دخولك أو حمّل ملفك الشخصي لعرض عدد أشجارك ورصيد نقاطك البيئية الحقيقي."
              }
              descriptionEn={
                profileError ||
                "Sign in or load your profile to see your real tree count and eco point balance."
              }
              actionAr={profileLoading ? "جارٍ التحميل…" : "تحميل بيانات حديقتي"}
              actionEn={profileLoading ? "Loading…" : "Load my garden data"}
              onAction={() => {
                if (!profileLoading) void loadUserProfile();
              }}
            />
          </div>
        ) : (
          <>
            <h4>
              {ar
                ? `حديقتك تحتوي حالياً على ${stats.virtualTrees} أشجار غاف صحية!`
                : `Your garden has ${stats.virtualTrees} healthy Ghaf trees!`}
            </h4>
            <p className="garden-tip">
              {ar
                ? `رصيدك الحالي: ${stats.ecoPoints} نقطة بيئية. استبدل ${TREE_COST} نقطة لزراعة شجرة جديدة ورعايتها.`
                : `Current points: ${stats.ecoPoints} Eco Points. Redeem ${TREE_COST} points to plant a new Ghaf tree.`}
            </p>

            <div className="garden-actions-row">
              <button
                type="button"
                onClick={handlePlantTree}
                className="btn btn-primary"
                disabled={!canPlant}
              >
                <Sprout size={16} aria-hidden="true" />{" "}
                {ar ? `ازرع شجرة جديدة (${TREE_COST} نقطة)` : `Plant New Tree (${TREE_COST} Pts)`}
              </button>
            </div>

            {!canPlant && (
              <p className="game-inline-alert is-warning" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  {ar
                    ? `تحتاج ${TREE_COST - stats.ecoPoints} نقطة إضافية لزراعة شجرة جديدة.`
                    : `You need ${TREE_COST - stats.ecoPoints} more eco points to plant a tree.`}
                </span>
              </p>
            )}
          </>
        )}

        <div className="game-live-region" aria-live="polite">
          {gardenMessage && (
            <p
              className={`game-inline-alert ${gardenMessage.tone === "success" ? "is-success" : "is-error"}`}
              role={gardenMessage.tone === "success" ? "status" : "alert"}
            >
              {gardenMessage.tone === "success" ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <AlertTriangle size={16} aria-hidden="true" />
              )}
              <span>{gardenMessage.text}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderCalculator = () => (
    <div className="carbon-game-box card">
      <div className="game-box-header">
        <button type="button" onClick={closeGame} className="btn btn-ghost btn-sm">
          {ar ? "← الرجوع للألعاب" : "← Back to Games"}
        </button>
        <h3>
          <BarChart3 size={20} aria-hidden="true" />{" "}
          {ar ? "محاكي البصمة الكربونية الشخصية" : "Personal Carbon Footprint Simulator"}
        </h3>
      </div>

      {finalFootprint !== null ? (
        <div className="game-result-panel text-center" role="status" aria-live="polite">
          <Trophy size={64} className="trophy-icon" aria-hidden="true" />
          <h4>{ar ? "نتيجتك النهائية جاهزة!" : "Your Carbon Footprint Result!"}</h4>
          <div className="result-number-box">
            <span className="result-num">{finalFootprint}</span>
            <span className="result-unit">{ar ? "طن كربون / سنوياً" : "Tons CO2 / Year"}</span>
          </div>

          <div className="feedback-rich-text">
            {finalFootprint > 7 ? (
              <p className="feedback-warning">
                <AlertTriangle size={18} aria-hidden="true" />
                {ar
                  ? "بصمتك الكربونية أعلى من المتوسط الإماراتي! يمكنك تقليلها بالاعتماد على وسائل النقل العام وترشيد الطاقة."
                  : "Your footprint is higher than the average. Try using public transport and saving energy."}
              </p>
            ) : (
              <p className="feedback-success">
                <TreePine size={18} aria-hidden="true" />
                {ar
                  ? "ممتاز! بصمتك الكربونية منخفضة وصديقة للبيئة. استمر في رعاية الكوكب."
                  : "Excellent! Your footprint is environment-friendly. Keep protecting the planet."}
              </p>
            )}
          </div>

          <div className="game-result-actions">
            <button
              type="button"
              onClick={saveScoreToDashboard}
              className="btn btn-primary"
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving"
                ? ar ? "جارٍ الحفظ…" : "Saving…"
                : ar ? "حفظ النتيجة في لوحة التحكم" : "Save to My Dashboard"}
            </button>
            <button type="button" onClick={resetGame} className="btn btn-ghost">
              <RefreshCw size={16} aria-hidden="true" />
              <span>{ar ? "إعادة اللعب" : "Play Again"}</span>
            </button>
          </div>

          {saveStatus === "success" && saveMessage && (
            <p className="game-inline-alert is-success" role="status">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{saveMessage}</span>
            </p>
          )}
          {saveStatus === "error" && saveMessage && (
            <p className="game-inline-alert is-error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{saveMessage}</span>
            </p>
          )}
        </div>
      ) : (
        renderQuizBody()
      )}
    </div>
  );

  return (
    <div className="games-hub-page-container container">
      {/* 1. Header */}
      <section className="games-header text-center">
        <span className="eyebrow">{t("gamesHub")}</span>
        <h1 className="section-title">
          {ar ? "ألعاب المناخ التعليمية التفاعلية" : "Interactive Educational Climate Games"}
        </h1>
        <p className="section-lead mx-auto">
          {ar
            ? "العب وتعلم معنا! ألعاب تعليمية تفاعلية من كلايمتيفاي تبسّط قضايا المناخ والاستدامة."
            : "Play and learn! Interactive educational games by Climatify that make climate and sustainability topics accessible."}
        </p>
      </section>

      {/* 2. Games List / Active Game view */}
      <section className="games-content-section section">
        {activeGame === "calculator"
          ? renderCalculator()
          : activeGame === "garden"
            ? renderGarden()
            : renderGamesList()}
      </section>

      {/* 3. Game Video Popup */}
      {videoGame && videoSource && (
        <VideoModal
          title={ar ? videoGame.titleAr : videoGame.titleEn}
          source={videoSource}
          onClose={closeVideo}
        />
      )}
    </div>
  );
};
