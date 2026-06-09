import { Badge } from "@/components/ui/badge";
import { DetailsSection } from "@/components/ui/details-section";
import { normalizeCandidateProfile } from "@/lib/candidate-profile-view.mjs";

/*
  Friendly full-detail renderer for the imported candidate profile (US-019
  CandidateProfile shape): identity facts, summary, categorized skills, and
  expandable experience / projects / education / certifications.
*/

type Fact = { label: string; value: string };

type ProfileView = {
  has_profile: boolean;
  facts: Fact[];
  links: Fact[];
  overview: string;
  background: string;
  seniority: string;
  skill_groups: { key: string; label: string; items: string[] }[];
  experience: {
    company: string;
    title: string;
    location: string;
    period: string;
    description: string;
    bullet_points: string[];
    detected_skills: string[];
  }[];
  projects: {
    name: string;
    type: string;
    description: string;
    tech_stack: string[];
    key_features: string[];
    impact: string;
    links: string[];
  }[];
  education: { school: string; degree: string; dates: string; details: string }[];
  certifications: { name: string; issuer: string; date: string }[];
  strongest_skills: string[];
  suggested_target_roles: string[];
  weak_ai_role_areas: string[];
};

export function CandidateProfileView({ profileJson }: { profileJson: unknown }) {
  const view = normalizeCandidateProfile(profileJson) as ProfileView;

  if (!view.has_profile) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 text-sm md:grid-cols-3">
        {view.facts.map((fact) => (
          <div key={fact.label}>
            <p className="font-medium">{fact.label}</p>
            <p className="break-words text-muted-foreground">{fact.value}</p>
          </div>
        ))}
        {view.links.map((link) => (
          <div key={link.label}>
            <p className="font-medium">{link.label}</p>
            <a
              href={link.value}
              target="_blank"
              rel="noreferrer"
              className="break-all text-muted-foreground underline underline-offset-4"
            >
              {link.value}
            </a>
          </div>
        ))}
      </div>

      {view.overview ? (
        <p className="text-sm leading-6 text-muted-foreground">{view.overview}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {view.seniority ? <Badge variant="secondary">{view.seniority}</Badge> : null}
        {view.background ? <Badge variant="outline">{view.background}</Badge> : null}
        {view.suggested_target_roles.map((role) => (
          <Badge key={role} variant="info">
            {role}
          </Badge>
        ))}
      </div>

      {view.skill_groups.length > 0 ? (
        <div className="grid gap-3">
          {view.skill_groups.map((group) => (
            <div key={group.key} className="flex flex-wrap items-center gap-2">
              <span className="w-32 shrink-0 text-sm font-medium">{group.label}</span>
              {group.items.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {view.experience.length > 0 ? (
        <DetailsSection summary={`Work experience (${view.experience.length})`} defaultOpen>
          <ul className="grid gap-4">
            {view.experience.map((item, index) => (
              <li key={`${item.company}-${index}`} className="grid gap-1">
                <p className="text-sm font-semibold">
                  {item.title} · {item.company}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[item.period, item.location].filter(Boolean).join(" · ")}
                </p>
                {item.description ? (
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                ) : null}
                {item.bullet_points.length > 0 ? (
                  <ul className="grid list-disc gap-1 pl-5 text-sm leading-6 text-muted-foreground">
                    {item.bullet_points.map((point, pointIndex) => (
                      <li key={pointIndex}>{point}</li>
                    ))}
                  </ul>
                ) : null}
                {item.detected_skills.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.detected_skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </DetailsSection>
      ) : null}

      {view.projects.length > 0 ? (
        <DetailsSection summary={`Projects (${view.projects.length})`}>
          <ul className="grid gap-4">
            {view.projects.map((project, index) => (
              <li key={`${project.name}-${index}`} className="grid gap-1">
                <p className="text-sm font-semibold">
                  {project.name}
                  {project.type ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {project.type}
                    </span>
                  ) : null}
                </p>
                {project.description ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
                {project.impact ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    <span className="font-medium text-foreground">Impact:</span>{" "}
                    {project.impact}
                  </p>
                ) : null}
                {project.tech_stack.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {project.tech_stack.map((tech) => (
                      <Badge key={tech} variant="outline">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </DetailsSection>
      ) : null}

      {view.education.length > 0 || view.certifications.length > 0 ? (
        <DetailsSection summary="Education & certifications">
          <div className="grid gap-3 text-sm">
            {view.education.map((item, index) => (
              <div key={`${item.school}-${index}`}>
                <p className="font-medium">{item.school}</p>
                <p className="text-muted-foreground">
                  {[item.degree, item.dates].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
            {view.certifications.map((item, index) => (
              <div key={`${item.name}-${index}`}>
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">
                  {[item.issuer, item.date].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </DetailsSection>
      ) : null}

      {view.strongest_skills.length > 0 || view.weak_ai_role_areas.length > 0 ? (
        <div className="grid gap-2 text-sm">
          {view.strongest_skills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Strongest skills:</span>
              {view.strongest_skills.map((skill) => (
                <Badge key={skill} variant="success">
                  {skill}
                </Badge>
              ))}
            </div>
          ) : null}
          {view.weak_ai_role_areas.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Areas to strengthen for AI roles:</span>
              {view.weak_ai_role_areas.map((area) => (
                <Badge key={area} variant="warning">
                  {area}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
