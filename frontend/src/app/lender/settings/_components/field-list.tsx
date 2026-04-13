"use client";
import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TemplateSectionField } from "@/types/template";

interface FieldListProps {
  fields: TemplateSectionField[];
  onChange: (fields: TemplateSectionField[]) => void;
}

function SortableField({
  field,
  onToggle,
  onLabelChange,
}: {
  field: TemplateSectionField;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg ${
        !field.enabled ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      <input
        type="checkbox"
        checked={field.enabled}
        onChange={onToggle}
        className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
      />

      <input
        type="text"
        value={field.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0 text-foreground"
      />

      <span className="text-xs text-muted-foreground hidden sm:inline">{field.key}</span>
    </div>
  );
}

export default function FieldList({ fields, onChange }: FieldListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fieldIds = useMemo(() => fields.map((f) => f.key), [fields]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.key === active.id);
    const newIndex = fields.findIndex((f) => f.key === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      order: i + 1,
    }));
    onChange(reordered);
  }

  function handleToggle(key: string) {
    onChange(
      fields.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  }

  function handleLabelChange(key: string, label: string) {
    onChange(
      fields.map((f) => (f.key === key ? { ...f, label } : f))
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {fields.map((field) => (
            <SortableField
              key={field.key}
              field={field}
              onToggle={() => handleToggle(field.key)}
              onLabelChange={(label) => handleLabelChange(field.key, label)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
