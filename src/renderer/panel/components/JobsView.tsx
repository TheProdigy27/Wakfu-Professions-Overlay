// Crafts par métier : ce qu'un métier fabrique, par niveau, jusqu'au niveau du joueur s'il l'indique. Un clic prépare le craft.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { jobCrafts, jobsByName, MAX_JOB_LEVEL, type JobCraft } from '../../../core/jobs/jobCrafts';
import { openJobs, selectTarget, setJobLevel, updateJobsFilter, useMessages, usePanel, type Catalog } from '../store';
import { Glyph } from './Glyph';
import { ItemIcon, ItemName, itemMeta, planLabel } from './Item';

/**
 * Défilement de la liste quand on l'a quittée (objet choisi, bouton Retour…), avec la liste affichée alors : on y revient
 * si c'est la même, le temps de la session.
 */
let savedScroll: { key: string; top: number } | null = null;

/** Bouton de la barre de recherche : ouvre ou ferme les crafts par métier. */
export function JobsButton() {
  const m = useMessages();
  const open = usePanel((s) => s.jobsOpen);
  const ready = usePanel((s) => s.catalog !== null);
  return (
    <button
      type="button"
      className={open ? 'jobs-button active' : 'jobs-button'}
      disabled={!ready}
      aria-pressed={open}
      title={m.jobs.title}
      onClick={() => openJobs(!open)}
    >
      {m.jobs.button}
    </button>
  );
}

export function JobsView() {
  const m = useMessages();
  const catalog = usePanel((s) => s.catalog);
  const filter = usePanel((s) => s.jobsFilter);
  const levels = usePanel((s) => s.jobLevels);
  const jobs = useMemo(() => (catalog ? jobsByName(catalog.index) : []), [catalog]);
  // Métier choisi absent des données (retiré par une mise à jour du jeu) : le premier de la liste.
  const jobId = jobs.find((job) => job.id === filter.jobId)?.id ?? jobs[0]?.id;
  const level = jobId === undefined ? undefined : levels[jobId];
  const list = useMemo(
    () =>
      catalog && jobId !== undefined
        ? jobCrafts(catalog.index, jobId, { maxLevel: level, query: filter.query, upgrades: filter.upgrades })
        : null,
    [catalog, jobId, level, filter.query, filter.upgrades],
  );
  // En revenant aux crafts par métier : là où on avait laissé la liste, si c'est la même. Autre métier, autre filtre
  // ou autres données : la liste repart du haut, sinon les premiers résultats resteraient cachés.
  const listKey = [catalog?.index.version, catalog?.index.locale, jobId, level, filter.query, filter.upgrades].join('|');
  const scroller = useRef<HTMLDivElement>(null);
  const shownKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const opening = shownKey.current === null;
    el.scrollTop = opening && savedScroll?.key === listKey ? savedScroll.top : 0;
    shownKey.current = listKey;
    // Position lue en quittant la liste (objet choisi, Retour, autre filtre…), avant qu'elle soit retirée de la page :
    // les événements de défilement ne sont pas envoyés quand la fenêtre n'est pas dessinée à l'écran.
    return () => {
      savedScroll = { key: listKey, top: el.scrollTop };
    };
  }, [listKey]);
  if (!catalog || jobId === undefined || !list) return null;
  const t = m.jobs;
  const jobName = catalog.index.jobs.get(jobId) ?? m.tree.unknownJob(jobId);

  return (
    <div className="jobs">
      <div className="jobs-head">
        <div className="jobs-tools">
          <select aria-label={t.job} value={jobId} onChange={(e) => updateJobsFilter({ jobId: Number(e.target.value) })}>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
          <label className="jobs-level" title={t.levelTitle}>
            {t.level}
            <input
              type="number"
              min={0}
              max={MAX_JOB_LEVEL}
              placeholder={t.allLevels}
              value={level ?? ''}
              onChange={(e) => setJobLevel(jobId, e.target.value === '' ? null : e.target.valueAsNumber)}
            />
          </label>
          <button type="button" className="close" title={m.common.close} aria-label={m.common.close} onClick={() => openJobs(false)}>
            <Glyph name="close" />
          </button>
        </div>
        <div className="jobs-tools">
          <input
            type="search"
            className="jobs-filter"
            placeholder={t.filter}
            value={filter.query}
            spellCheck={false}
            onChange={(e) => updateJobsFilter({ query: e.target.value })}
          />
          <label className="jobs-upgrades" title={t.upgradesTitle}>
            <input type="checkbox" checked={filter.upgrades} onChange={(e) => updateJobsFilter({ upgrades: e.target.checked })} />
            {t.upgrades}
          </label>
        </div>
        <p className="jobs-count">{t.count(list.shown, list.total)}</p>
      </div>
      <div className="view jobs-list" ref={scroller}>
        {list.groups.length === 0 && <p className="empty">{t.none}</p>}
        {list.groups.map((group) => (
          <section key={group.level}>
            <h3>{m.tree.recipe(jobName, group.level)}</h3>
            <ul>
              {group.crafts.map((craft) => (
                <JobCraftRow key={craft.item.id} craft={craft} catalog={catalog} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function JobCraftRow({ craft, catalog }: { craft: JobCraft; catalog: Catalog }) {
  const m = useMessages();
  const { item, recipe } = craft;
  return (
    <li>
      <button type="button" className="job-craft" title={m.jobs.choose} onClick={() => selectTarget(item.id)}>
        <ItemIcon item={item} />
        <span className="job-craft-text">
          <ItemName item={item} itemId={item.id} />
          <span className="meta">{itemMeta(catalog.index, item, m)}</span>
        </span>
        {recipe.isUpgrade && <span className="badge">{m.common.upgrade}</span>}
        {recipe.plan !== undefined && (
          <span className="badge" title={planLabel(catalog.index, recipe.plan, m)}>
            {m.common.plan}
          </span>
        )}
      </button>
    </li>
  );
}
