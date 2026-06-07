export function getWorkspaceCounts({ profile, resumes, jobs }) {
  return {
    profiles: profile ? 1 : 0,
    resumes: resumes.length,
    jobs: jobs.length,
  };
}

export function getWorkspaceRecommendation({ profile, resumes, jobs }) {
  const score = Math.min(
    100,
    (profile ? 34 : 0) + resumes.length * 33 + jobs.length * 33
  );
  const ready = resumes.length > 0 && jobs.length > 0;

  return {
    score,
    label: ready ? "Ready to compare" : "Add inputs",
    message: ready
      ? "Resume and job inputs are saved. The next slice can generate match analysis."
      : "Save at least one resume and one job description before match analysis.",
  };
}
