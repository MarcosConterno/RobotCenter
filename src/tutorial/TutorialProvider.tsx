"use client";

import { driver, type Driver } from "driver.js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { findTourPage, findTourTarget } from "./targetCatalog";
import { resolveTutorialSteps } from "./tutorials";
import { ONBOARDING_KEY, ONBOARDING_VERSION, type TutorialProgress, type TutorialStepDefinition } from "./types";
import type { TutorialDraftStep } from "./adminTypes";

interface PublishedTutorial { id: string; key: string; name: string; version: number; steps: Array<TutorialStepDefinition & { conditionKey?: string | null }> }
interface TutorialContextValue {
  progress: TutorialProgress; loading: boolean; saving: boolean; running: boolean; testMode: boolean; error: string;
  startTutorial: () => Promise<void>; continueTutorial: () => Promise<void>; restartTutorial: () => Promise<void>; skipTutorial: () => Promise<void>;
  previewTutorial: (name: string, steps: TutorialDraftStep[]) => void;
}

const initialProgress: TutorialProgress = { tutorialKey: ONBOARDING_KEY, tutorialVersion: ONBOARDING_VERSION, status: "not_started", currentStep: 0, startedAt: null, completedAt: null, updatedAt: null };
const TutorialContext = createContext<TutorialContextValue | null>(null);

function findTarget(selectors: string[]) { for (const selector of selectors) { const element = document.querySelector(selector); if (element) return element; } return null; }
function waitForTarget(selectors: string[], timeoutMs = 6000): Promise<Element | null> {
  const current = findTarget(selectors); if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (element: Element | null) => { if (settled) return; settled = true; observer.disconnect(); window.clearTimeout(timeout); resolve(element); };
    const observer = new MutationObserver(() => { const element = findTarget(selectors); if (element) finish(element); });
    const timeout = window.setTimeout(() => finish(null), timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const access = useAdminAccess();
  const [progress, setProgress] = useState(initialProgress); const [published, setPublished] = useState<PublishedTutorial | null>(null);
  const [previewSteps, setPreviewSteps] = useState<TutorialStepDefinition[] | null>(null); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [running, setRunning] = useState(false); const [error, setError] = useState("");
  const driverRef = useRef<Driver | null>(null); const pendingStepRef = useRef<{ index: number; direction: 1 | -1 } | null>(null);
  const navigateRef = useRef<(index: number, direction: 1 | -1) => Promise<void>>(async () => undefined);
  const stepsRef = useRef<TutorialStepDefinition[]>([]); const testModeRef = useRef(false); const testReturnPathRef = useRef("/dashboard");

  const fallbackSteps = useMemo(() => resolveTutorialSteps({ canAccessRobots: access.canAccessRobots, canAccessFlows: access.canAccessFlows, canAccessSettings: access.canAccessSettings }), [access.canAccessFlows, access.canAccessRobots, access.canAccessSettings]);
  const publishedSteps = useMemo(() => (published?.steps ?? []).filter((step) => {
    const condition = step.conditionKey;
    return !condition || (condition === "canAccessRobots" && access.canAccessRobots) || (condition === "canAccessFlows" && access.canAccessFlows) || (condition === "canAccessSettings" && access.canAccessSettings) || (condition === "canManageTutorials" && access.canManageTutorials);
  }), [access.canAccessFlows, access.canAccessRobots, access.canAccessSettings, access.canManageTutorials, published]);
  const steps = previewSteps ?? (publishedSteps.length ? publishedSteps : fallbackSteps);
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  useEffect(() => {
    if (access.status !== "ready" || !access.roles.length) return;
    let active = true; setLoading(true); setError("");
    void fetch("/api/tutorials/active", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { tutorial?: PublishedTutorial | null; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar o tutorial.");
      if (!active) return;
      const activeTutorial = payload.tutorial ?? null; setPublished(activeTutorial);
      const key = activeTutorial?.key ?? ONBOARDING_KEY; const version = activeTutorial?.version ?? ONBOARDING_VERSION;
      const progressResponse = await fetch(`/api/tutorial-progress?tutorialKey=${encodeURIComponent(key)}&tutorialVersion=${version}`, { cache: "no-store" });
      const progressPayload = await progressResponse.json() as { progress?: TutorialProgress; error?: string };
      if (!progressResponse.ok || !progressPayload.progress) throw new Error(progressPayload.error ?? "Não foi possível carregar o progresso.");
      if (active) setProgress(progressPayload.progress);
    }).catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o tutorial."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [access.roles.length, access.status]);

  const persist = useCallback(async (status: "in_progress" | "completed" | "skipped", currentStep: number, restart = false) => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/tutorial-progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tutorialId: published?.id ?? null, tutorialKey: published?.key ?? ONBOARDING_KEY, tutorialVersion: published?.version ?? ONBOARDING_VERSION, status, currentStep, restart }) });
      const payload = await response.json() as { progress?: TutorialProgress; error?: string };
      if (!response.ok || !payload.progress) throw new Error(payload.error ?? "Não foi possível salvar o tutorial.");
      setProgress(payload.progress); return payload.progress;
    } catch (persistError) { setError(persistError instanceof Error ? persistError.message : "Não foi possível salvar o tutorial."); throw persistError; }
    finally { setSaving(false); }
  }, [published]);

  const closeDriver = useCallback(() => { driverRef.current?.destroy(); driverRef.current = null; setRunning(false); }, []);
  const finishTest = useCallback(() => { const returnPath = testReturnPathRef.current; closeDriver(); testModeRef.current = false; setPreviewSteps(null); if (window.location.pathname !== returnPath) router.push(returnPath); }, [closeDriver, router]);
  const completeTutorial = useCallback(async () => { if (testModeRef.current) { finishTest(); return; } await persist("completed", Math.max(stepsRef.current.length - 1, 0)); closeDriver(); }, [closeDriver, finishTest, persist]);
  const skipTutorial = useCallback(async () => { if (testModeRef.current) { finishTest(); return; } if (running && !window.confirm("Pular o tutorial agora? Você poderá iniciá-lo novamente pela sidebar.")) return; await persist("skipped", progress.currentStep); closeDriver(); }, [closeDriver, finishTest, persist, progress.currentStep, running]);

  const launchStep = useCallback(async (index: number, direction: 1 | -1) => {
    const currentSteps = stepsRef.current; const step = currentSteps[index];
    if (!step) { if (direction > 0) await completeTutorial(); return; }
    if (step.targets.includes('[data-tour="my-page-todos"]')) document.querySelector<HTMLButtonElement>('[data-tour="my-page-tab-todo"]')?.click();
    if (step.targets.includes('[data-tour="my-page-meetings"]')) document.querySelector<HTMLButtonElement>('[data-tour="my-page-tab-meetings"]')?.click();
    if (step.targets.includes('[aria-labelledby="notes-title"]')) document.querySelector<HTMLButtonElement>('[data-tour="my-page-tab-notes"]')?.click();
    if (step.targets.includes('[data-tour="dashboard-recent-updates"]')) document.querySelector<HTMLButtonElement>('[data-tour="dashboard-overview-tab"]')?.click();
    if (step.targets.includes('[data-tour="dashboard-robots-table"]')) document.querySelector<HTMLButtonElement>('[data-tour="dashboard-robots-tab"]')?.click();
    const target = await waitForTarget(step.targets); if (!target) { await navigateRef.current(index + direction, direction); return; }
    if (!testModeRef.current) await persist("in_progress", index);
    driverRef.current?.destroy();
    const instance = driver({
      animate: true, smoothScroll: true, allowClose: true, allowKeyboardControl: true, overlayColor: "#020617", overlayOpacity: 0.58, stagePadding: 7, stageRadius: 12,
      popoverClass: `robot-center-tour${testModeRef.current ? " is-test" : ""}`, showProgress: true, progressText: `${index + 1} de ${currentSteps.length}`,
      prevBtnText: "Anterior", nextBtnText: index === currentSteps.length - 1 ? "Concluir" : "Próximo", doneBtnText: index === currentSteps.length - 1 ? "Concluir" : "Próximo",
      showButtons: ["previous", "next", "close"], disableButtons: index === 0 ? ["previous"] : [],
      onNextClick: () => { if (index === currentSteps.length - 1) void completeTutorial(); else void navigateRef.current(index + 1, 1); },
      onDoneClick: () => { if (index === currentSteps.length - 1) void completeTutorial(); else void navigateRef.current(index + 1, 1); },
      onPrevClick: () => { void navigateRef.current(index - 1, -1); }, onCloseClick: () => { if (testModeRef.current) finishTest(); else closeDriver(); },
      onDestroyed: () => { driverRef.current = null; setRunning(false); },
      onPopoverRender: (popover) => {
        if (testModeRef.current) { const badge = document.createElement("span"); badge.className = "robot-center-tour-test-badge"; badge.textContent = "Modo de teste"; popover.title.before(badge); }
        const skip = document.createElement("button"); skip.type = "button"; skip.className = "robot-center-tour-skip"; skip.textContent = testModeRef.current ? "Encerrar teste" : "Pular"; skip.addEventListener("click", () => { void skipTutorial(); }); popover.footerButtons.prepend(skip);
      },
      steps: [{ element: target, popover: { title: step.title, description: step.description, side: step.side, align: "start" } }],
    });
    driverRef.current = instance; setRunning(true); instance.drive();
  }, [closeDriver, completeTutorial, finishTest, persist, skipTutorial]);

  const navigateTo = useCallback(async (index: number, direction: 1 | -1) => {
    const bounded = Math.max(0, index); const step = stepsRef.current[bounded];
    if (!step) { if (direction > 0) await completeTutorial(); return; }
    if (pathname !== step.route) { driverRef.current?.destroy(); pendingStepRef.current = { index: bounded, direction }; router.push(step.route); return; }
    await launchStep(bounded, direction);
  }, [completeTutorial, launchStep, pathname, router]);
  useEffect(() => { navigateRef.current = navigateTo; }, [navigateTo]);
  useEffect(() => { const pending = pendingStepRef.current; if (!pending || stepsRef.current[pending.index]?.route !== pathname) return; pendingStepRef.current = null; void launchStep(pending.index, pending.direction); }, [launchStep, pathname]);
  useEffect(() => () => driverRef.current?.destroy(), []);

  const startTutorial = useCallback(async () => { testModeRef.current = false; setPreviewSteps(null); stepsRef.current = publishedSteps.length ? publishedSteps : fallbackSteps; await persist("in_progress", 0, true); await navigateRef.current(0, 1); }, [fallbackSteps, persist, publishedSteps]);
  const continueTutorial = useCallback(async () => { await navigateRef.current(Math.min(progress.currentStep, Math.max(stepsRef.current.length - 1, 0)), 1); }, [progress.currentStep]);
  const previewTutorial = useCallback((name: string, draftSteps: TutorialDraftStep[]) => {
    const mapped = draftSteps.flatMap((step) => { if (!step.enabled) return []; const page = findTourPage(step.pageKey); const target = findTourTarget(step.pageKey, step.targetKey); if (!page || !target) return []; return [{ id: step.id, route: page.route, targets: [target.selector], title: step.title || name, description: step.description, side: step.placement } satisfies TutorialStepDefinition]; });
    if (!mapped.length) { setError("Adicione ao menos um passo habilitado para testar."); return; }
    testModeRef.current = true; testReturnPathRef.current = pathname; stepsRef.current = mapped; setPreviewSteps(mapped); void navigateRef.current(0, 1);
  }, [pathname]);

  const value = useMemo<TutorialContextValue>(() => ({ progress, loading, saving, running, testMode: testModeRef.current, error, startTutorial, continueTutorial, restartTutorial: startTutorial, skipTutorial, previewTutorial }), [continueTutorial, error, loading, previewTutorial, progress, running, saving, skipTutorial, startTutorial]);
  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() { const context = useContext(TutorialContext); if (!context) throw new Error("useTutorial deve ser usado dentro de TutorialProvider."); return context; }
