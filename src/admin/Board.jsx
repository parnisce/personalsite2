import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { TbPlayerPlayFilled, TbPlayerStopFilled, TbPlus } from 'react-icons/tb'
import { useAdmin } from './ctx'
import { STATUSES, formatDuration, taskSeconds } from './store'
import { DueChip, LabelChips, PriorityChip, StatusTag, SubtaskMeter } from './ui'

// The play button must not start a drag or open the editor.
const stop = (e) => e.stopPropagation()

function TimerButton({ task, running, onToggle }) {
  return (
    <button
      type="button"
      className={`adm-play${running ? ' is-running' : ''}`}
      aria-label={running ? `Stop the timer for ${task.title}` : `Start the timer for ${task.title}`}
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onKeyDown={stop}
      onClick={(e) => {
        e.stopPropagation()
        onToggle(task.id)
      }}
    >
      {running ? <TbPlayerStopFilled aria-hidden="true" /> : <TbPlayerPlayFilled aria-hidden="true" />}
    </button>
  )
}

function CardBody({ task, today, seconds, running, onToggle, overlay }) {
  return (
    <>
      <StatusTag status={task.status} />
      <h4>{task.title}</h4>
      {task.description && <p>{task.description}</p>}
      <div className="adm-chips">
        <PriorityChip priority={task.priority} />
        <DueChip item={task} today={today} />
        <LabelChips labels={task.labels} max={2} />
      </div>
      <div className="adm-card-foot">
        <span className="adm-mono">{formatDuration(seconds)}</span>
        <SubtaskMeter task={task} />
        {!overlay && <TimerButton task={task} running={running} onToggle={onToggle} />}
      </div>
    </>
  )
}

function Card({ task, onOpen }) {
  const { state, today, now, toggleTimer } = useAdmin()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const running = state.timer?.taskId === task.id
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`adm-card${isDragging ? ' is-dragging' : ''}${running ? ' is-running' : ''}`}
      {...attributes}
      {...listeners}
      aria-label={`${task.title}. Press Enter to edit, or Space to move it.`}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'Enter') onOpen(task.id)
      }}
    >
      <CardBody task={task} today={today} seconds={taskSeconds(state, task, now)} running={running} onToggle={toggleTimer} />
    </article>
  )
}

function Column({ status, tasks, onOpen, onNew }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}` })
  return (
    <section className={`adm-col${isOver ? ' is-over' : ''}`} aria-label={`${status.label}, ${tasks.length} task${tasks.length === 1 ? '' : 's'}`}>
      <header className="adm-col-head">
        <i style={{ background: status.color }} aria-hidden="true" />
        <h3>{status.label}</h3>
        <span className="adm-count">{tasks.length}</span>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="adm-col-body">
          {tasks.map((t) => (
            <Card key={t.id} task={t} onOpen={onOpen} />
          ))}
          <button type="button" className="adm-add" onClick={() => onNew(status.id)}>
            <TbPlus aria-hidden="true" /> Add
          </button>
        </div>
      </SortableContext>
    </section>
  )
}

// `tasks` is already filtered; moves are reported as (id, status, beforeId).
export default function Board({ tasks, onMove, onOpen, onNew }) {
  const { state, today, now, toggleTimer } = useAdmin()
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch screens a short press picks a card up, so the board can still be scrolled.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  )

  const byId = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks])
  const columns = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.id, tasks.filter((t) => t.status === s.id)])), [tasks])
  const active = activeId ? byId[activeId] : null

  const title = (id) => byId[id]?.title ?? 'task'
  const where = (id) => {
    const key = String(id)
    return key.startsWith('col:') ? `the ${STATUSES.find((s) => s.id === key.slice(4))?.label} column` : title(id)
  }
  const announcements = {
    onDragStart: ({ active: a }) => `Picked up ${title(a.id)}.`,
    onDragOver: ({ active: a, over }) => (over ? `${title(a.id)} is over ${where(over.id)}.` : undefined),
    onDragEnd: ({ active: a, over }) => (over ? `Dropped ${title(a.id)} on ${where(over.id)}.` : `${title(a.id)} was dropped.`),
    onDragCancel: ({ active: a }) => `Moving ${title(a.id)} was cancelled.`,
  }

  const onDragEnd = ({ active: a, over }) => {
    setActiveId(null)
    if (!over) return
    const moving = byId[a.id]
    const overId = String(over.id)
    let status
    let beforeId = null
    if (overId.startsWith('col:')) {
      status = overId.slice(4) // dropped on empty column space: goes to the end
    } else {
      const target = byId[overId]
      if (!target || target.id === moving.id) return
      status = target.status
      const list = columns[status]
      const overIndex = list.findIndex((t) => t.id === overId)
      if (moving.status === status) {
        const fromIndex = list.findIndex((t) => t.id === moving.id)
        // Moving down lands after the card it was dropped on; moving up lands before it.
        beforeId = fromIndex < overIndex ? list[overIndex + 1]?.id ?? null : overId
      } else {
        beforeId = overId
      }
    }
    onMove(moving.id, status, beforeId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'To pick up a task, press Space. Use the arrow keys to move it, Space to drop it, and Escape to cancel.' } }}
      onDragStart={({ active: a }) => setActiveId(a.id)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="adm-board">
        {STATUSES.map((s) => (
          <Column key={s.id} status={s} tasks={columns[s.id]} onOpen={onOpen} onNew={onNew} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>
        {active ? (
          <article className="adm-card is-overlay">
            <CardBody task={active} today={today} seconds={taskSeconds(state, active, now)} running={false} onToggle={toggleTimer} overlay />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
