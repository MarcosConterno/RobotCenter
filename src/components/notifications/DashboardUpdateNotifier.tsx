"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppData } from "@/data/AppDataProvider";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { announceDashboardUnreadCount, DASHBOARD_UNREAD_STORAGE_KEY, readDashboardUnreadCount } from "@/domain/dashboard-notifications";

const NOTIFICATION_PERMISSION_REQUESTED_KEY = "robot-center:notification-permission-requested";
const FAVICON_SELECTOR = "link[rel='icon'], link[rel='shortcut icon']";
const DEFAULT_FAVICON = "/images/robot-center-system-logo-transparent.png";

type PublicationRow = Database["public"]["Tables"]["publicacoes"]["Row"];

function updateFavicon(hasUnreadUpdates: boolean) {
  const favicon = document.querySelector<HTMLLinkElement>(FAVICON_SELECTOR);
  if (!favicon) return;

  if (!hasUnreadUpdates) {
    favicon.href = DEFAULT_FAVICON;
    return;
  }

  const image = new Image();
  image.onload = () => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(image, 0, 0, size, size);
    context.beginPath();
    context.arc(51, 13, 11, 0, Math.PI * 2);
    context.fillStyle = "#ef4444";
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = "#ffffff";
    context.stroke();
    favicon.href = canvas.toDataURL("image/png");
  };
  image.src = DEFAULT_FAVICON;
}

export default function DashboardUpdateNotifier() {
  const pathname = usePathname();
  const router = useRouter();
  const { robos } = useAppData();
  const robosRef = useRef(robos);
  const notifiedPublicationIds = useRef(new Set<string>());
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    robosRef.current = robos;
  }, [robos]);

  const clearUnreadUpdates = useCallback(() => {
    window.sessionStorage.removeItem(DASHBOARD_UNREAD_STORAGE_KEY);
    setUnreadCount(0);
    announceDashboardUnreadCount(0);
  }, []);

  useEffect(() => {
    const count = readDashboardUnreadCount();
    setUnreadCount(count);
    announceDashboardUnreadCount(count);
  }, []);

  useEffect(() => {
    if (pathname === "/dashboard" && document.visibilityState === "visible") {
      clearUnreadUpdates();
    }
  }, [clearUnreadUpdates, pathname]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (pathname === "/dashboard" && document.visibilityState === "visible") {
        clearUnreadUpdates();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearUnreadUpdates, pathname]);

  useEffect(() => {
    const titleWithoutIndicator = document.title.replace(/^●\s*/, "");
    document.title = unreadCount > 0 ? `● ${titleWithoutIndicator}` : titleWithoutIndicator;
    updateFavicon(unreadCount > 0);
  }, [pathname, unreadCount]);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    if (window.localStorage.getItem(NOTIFICATION_PERMISSION_REQUESTED_KEY) === "true") return;

    const requestPermission = () => {
      window.localStorage.setItem(NOTIFICATION_PERMISSION_REQUESTED_KEY, "true");
      void Notification.requestPermission();
      window.removeEventListener("pointerdown", requestPermission);
      window.removeEventListener("keydown", requestPermission);
    };

    window.addEventListener("pointerdown", requestPermission, { once: true });
    window.addEventListener("keydown", requestPermission, { once: true });
    return () => {
      window.removeEventListener("pointerdown", requestPermission);
      window.removeEventListener("keydown", requestPermission);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-update-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "publicacoes" },
        (payload) => {
          const publication = payload.new as PublicationRow;
          if (notifiedPublicationIds.current.has(publication.id)) return;
          notifiedPublicationIds.current.add(publication.id);

          const dashboardIsVisible = window.location.pathname === "/dashboard"
            && document.visibilityState === "visible";
          if (!dashboardIsVisible) {
            setUnreadCount((current) => {
              const next = current + 1;
              window.sessionStorage.setItem(DASHBOARD_UNREAD_STORAGE_KEY, String(next));
              announceDashboardUnreadCount(next);
              return next;
            });
          }

          if ("Notification" in window && Notification.permission === "granted") {
            const robot = robosRef.current.find((item) => item.id === publication.robo_id);
            const notification = new Notification("Nova atualização no Robot Center", {
              body: robot
                ? `${robot.nome}: ${publication.descricao}`
                : publication.descricao,
              icon: DEFAULT_FAVICON,
              tag: `robot-center-publication-${publication.id}`,
            });
            notification.onclick = () => {
              window.focus();
              router.push("/dashboard");
              notification.close();
            };
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
