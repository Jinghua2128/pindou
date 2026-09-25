"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PRESETS, type Preset } from "@/lib/presets";
import { BeadArt } from "@/components/ui/BeadArt";
export function TemplateRail({
  onChoose,
}: {
  onChoose: (preset: Preset) => void;
}) {
  return (
    <section className="template-rail">
      <div className="rail-heading">
        <h2>Your next little obsession</h2>
        <Link href="/presets">
          View all templates <ArrowRight size={17} />
        </Link>
      </div>
      <div className="template-row">
        {PRESETS.slice(1, 5).map((p) => (
          <button
            className="mini-template"
            key={p.id}
            onClick={() => onChoose(p)}
          >
            <div className="mini-art" style={{ background: p.background }}>
              <BeadArt cells={p.cells} width={p.size} name={p.name} />
            </div>
            <span className="mini-copy">
              <strong>{p.name}</strong>
              <small>{p.description}</small>
            </span>
            <span className="round-arrow">
              <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
