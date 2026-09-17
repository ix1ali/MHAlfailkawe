"use client";

import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/files";
import type { Building } from "@/lib/types";

/**
 * صورة واجهة العمارة.
 *
 * تُرسم المعاينة المصغّرة المحفوظة مع بيانات العمارة فورًا (بلا أي طلب)،
 * ثم تحلّ الصورة الحقيقية محلها حين تصل. ولأن لكل رفع مفتاحًا جديدًا،
 * يحفظها المتصفح ولا يعيد تحميلها عند التنقّل بين العمارات.
 */
export function BuildingPhoto({
  building,
  className = "",
  position = "50% 38%",
  eager,
  fallback,
}: {
  building?: Pick<Building, "photo" | "photoBlur" | "color">;
  className?: string;
  position?: string;
  eager?: boolean;
  fallback?: React.ReactNode;
}) {
  const src = building?.photo ? fileUrl(building.photo) : null;
  const blur = building?.photoBlur;
  // نتذكّر أي صورة اكتمل تحميلها، فيعود التبديل إلى المعاينة تلقائيًا
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;

  if (!src) return <>{fallback ?? <div className={`absolute inset-0 ${className}`} style={{ background: building?.color ?? "var(--primary)" }} />}</>;

  return (
    <>
      {blur && (
        <div
          aria-hidden
          className={`absolute inset-0 ${className}`}
          style={{
            backgroundImage: `url(${blur})`,
            backgroundSize: "cover",
            backgroundPosition: position,
            filter: "blur(12px)",
            transform: "scale(1.06)",
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setLoadedSrc(src)}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        style={{
          objectPosition: position,
          opacity: blur && !loaded ? 0 : 1,
          transition: "opacity .25s ease",
        }}
      />
    </>
  );
}

/**
 * يحمّل صور بقية العمارات في الخلفية بعد فتح النظام،
 * فيصير التنقّل بين العمارات فوريًا بلا انتظار.
 */
export function usePrefetchPhotos(buildings: Pick<Building, "photo">[]) {
  const keys = buildings.map((b) => b.photo).filter(Boolean).join(",");
  useEffect(() => {
    if (!keys) return;
    const t = setTimeout(() => {
      keys.split(",").forEach((k) => { new Image().src = fileUrl(k); });
    }, 600);
    return () => clearTimeout(t);
  }, [keys]);
}
