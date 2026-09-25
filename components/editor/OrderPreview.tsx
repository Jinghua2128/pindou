"use client";
import { useMemo, useState } from "react";
import { Download, Leaf, Link2, Magnet, Frame, Package } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BeadArt } from "@/components/ui/BeadArt";
import { useEditor } from "@/stores/editor";
import {
  calculatePrice,
  money,
  orderSnapshot,
  type ProductType,
} from "@/lib/pricing";
import { structuralCheck } from "@/lib/grid";
import { downloadFile } from "@/lib/storage";
export function OrderPreview({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project),
    [type, setType] = useState<ProductType>("keychain");
  const price = calculatePrice(project, type),
    structure = useMemo(
      () => structuralCheck(project.cells, project.width, project.height),
      [project],
    );
  return (
    <Modal title="From your screen, to your world." onClose={onClose} wide>
      <div className="order-preview">
        <div className="physical-preview">
          {type === "keychain" ? <span className="key-ring" /> : null}
          <BeadArt
            cells={project.cells}
            width={project.width}
            name={project.name}
          />
          <strong>{project.name}</strong>
          <span>
            {(project.width * 0.5).toFixed(1)} ×{" "}
            {(project.height * 0.5).toFixed(1)} cm board · 5 mm beads
          </span>
        </div>
        <div>
          <p className="modal-description">
            A little something you made. Choose its next adventure.
          </p>
          <div className="product-options">
            {(
              [
                { id: "art", name: "Bead art", Icon: Leaf },
                { id: "keychain", name: "Keychain", Icon: Link2 },
                { id: "magnet", name: "Magnet", Icon: Magnet },
                { id: "frame", name: "Framed", Icon: Frame },
              ] as const
            ).map(({ id, name, Icon }) => (
              <button
                key={id}
                className={type === id ? "selected" : ""}
                onClick={() => setType(id)}
              >
                <Icon size={21} />
                {name}
              </button>
            ))}
          </div>
          <div className="price-lines">
            <div>
              <span>Crafting & materials ({price.beads} beads)</span>
              <span>
                {money(
                  price.base +
                    price.materials +
                    price.complexity +
                    price.handling,
                )}
              </span>
            </div>
            <div>
              <span>Accessory</span>
              <span>{money(price.accessory)}</span>
            </div>
            <div>
              <span>Packaging</span>
              <span>{money(price.packaging)}</span>
            </div>
            {price.subtotal >
            price.base +
              price.materials +
              price.complexity +
              price.handling +
              price.accessory +
              price.packaging ? (
              <div>
                <span>Minimum order adjustment</span>
                <span>
                  {money(
                    price.subtotal -
                      (price.base +
                        price.materials +
                        price.complexity +
                        price.handling +
                        price.accessory +
                        price.packaging),
                  )}
                </span>
              </div>
            ) : null}
            <div>
              <span>Singapore delivery</span>
              <span>{money(price.shipping)}</span>
            </div>
            <div className="price-total">
              <strong>Estimated total</strong>
              <strong>{money(price.total)}</strong>
            </div>
          </div>
          {structure.groups.length > 1 ? (
            <p className="structure-note">
              {structure.groups.length} separate sections: these would need to
              be made separately. Connect them in the editor for a single piece.
            </p>
          ) : null}
          <div className="local-notice">
            <Package size={19} />
            <p>
              Physical ordering is not open yet. Save a production-ready brief
              with your pattern, materials and estimate.
            </p>
          </div>
          <button
            className="primary full"
            onClick={() =>
              downloadFile(
                new Blob(
                  [JSON.stringify(orderSnapshot(project, type), null, 2)],
                  { type: "application/json" },
                ),
                `${project.name}-production.json`,
              )
            }
          >
            <Download size={16} />
            Download production brief
          </button>
        </div>
      </div>
    </Modal>
  );
}
