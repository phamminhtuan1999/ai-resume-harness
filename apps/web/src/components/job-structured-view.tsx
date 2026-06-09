import { Badge } from "@/components/ui/badge";

/*
  Narrative body of the job detail page, in job-post reading order: overview,
  responsibilities, must-have / nice-to-have requirements, AI and cloud focus,
  benefits, company blurb. Facts (location, salary, …) are rendered by the
  page's "At a glance" rail, not here.
*/

export type JobPostViewModel = {
  has_structured: boolean;
  overview: string;
  overview_derived: boolean;
  about_company: string;
  facts: { label: string; value: string }[];
  responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  ai_requirements: string[];
  cloud_requirements: string[];
  benefits: string[];
  confidence_score: number | null;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm leading-6 text-muted-foreground marker:text-border">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function BadgeCloud({
  items,
  variant,
}: {
  items: string[];
  variant: "secondary" | "outline";
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function JobPostBody({
  view,
  company,
}: {
  view: JobPostViewModel;
  company?: string;
}) {
  if (!view.has_structured) {
    return null;
  }

  return (
    <div className="grid gap-5">
      {view.overview ? (
        <div>
          <SectionHeading>About the role</SectionHeading>
          <p className="mt-2 text-sm leading-7 whitespace-pre-wrap">{view.overview}</p>
          {view.overview_derived ? (
            <p className="mt-1 text-xs text-muted-foreground">
              From the opening of the original posting.
            </p>
          ) : null}
        </div>
      ) : null}

      {view.responsibilities.length > 0 ? (
        <div className="border-t pt-5">
          <SectionHeading>What you&apos;ll do</SectionHeading>
          <BulletList items={view.responsibilities} />
        </div>
      ) : null}

      {view.required_skills.length > 0 || view.preferred_skills.length > 0 ? (
        <div className="border-t pt-5">
          <SectionHeading>What they&apos;re looking for</SectionHeading>
          {view.required_skills.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                Must have
              </p>
              <BadgeCloud items={view.required_skills} variant="secondary" />
            </div>
          ) : null}
          {view.preferred_skills.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                Nice to have
              </p>
              <BadgeCloud items={view.preferred_skills} variant="outline" />
            </div>
          ) : null}
        </div>
      ) : null}

      {view.ai_requirements.length > 0 ? (
        <div className="border-t pt-5">
          <SectionHeading>AI / ML focus</SectionHeading>
          <BulletList items={view.ai_requirements} />
        </div>
      ) : null}

      {view.cloud_requirements.length > 0 ? (
        <div className="border-t pt-5">
          <SectionHeading>Cloud &amp; infrastructure</SectionHeading>
          <BadgeCloud items={view.cloud_requirements} variant="outline" />
        </div>
      ) : null}

      {view.benefits.length > 0 ? (
        <div className="border-t pt-5">
          <SectionHeading>Benefits</SectionHeading>
          <BulletList items={view.benefits} />
        </div>
      ) : null}

      {view.about_company ? (
        <div className="border-t pt-5">
          <SectionHeading>{company ? `About ${company}` : "About the company"}</SectionHeading>
          <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
            {view.about_company}
          </p>
        </div>
      ) : null}
    </div>
  );
}
