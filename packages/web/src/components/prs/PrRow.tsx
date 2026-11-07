import type { PrCard } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { Badge, StatusBadge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";
import { PrGlyphs } from "./PrGlyphs.tsx";

export function PrRow({ card, wide = false }: { card: PrCard; wide?: boolean }) {
  const { pr } = card;
  const finished = pr.state === "merged" || pr.state === "closed";
  return (
    <div className="row" data-state={pr.state}>
      {finished ? <StatusBadge value={pr.state} /> : <PrGlyphs checks={pr.checks} review={pr.review} />}
      <div className="row-stack">
        <button type="button" className="row-title" onClick={() => openEntity(pr.ref)}>
          {pr.title}
        </button>
        <div className="row-sub">
          <a className="chip" href={pr.url} target="_blank" rel="noreferrer">
            {pr.repo}#{pr.number}
          </a>
          {pr.state === "draft" ? <Badge>draft</Badge> : null}
          {card.attention.map((item) => (
            <Badge
              key={item}
              tone={item === "ready to merge" ? "good" : item === "needs review" ? "warn" : "bad"}
            >
              {item}
            </Badge>
          ))}
          {wide ? card.issues.map((issue) => <RefLink key={issue} value={issue} />) : null}
        </div>
      </div>
      {wide ? (
        <>
          <span className="muted">
            +{pr.additions} -{pr.deletions}
          </span>
          <span className="muted">{pr.author}</span>
          <TimeAgo iso={pr.updatedAt} />
        </>
      ) : null}
    </div>
  );
}
