import * as core from "@actions/core";
import { exec } from "@actions/exec";
import fs from "fs-extra";
import * as gitUtils from "./gitUtils";
import { runPublish, runVersion } from "./run";
import readChangesetState from "./readChangesetState";

const getOptionalInput = (name: string) => core.getInput(name) || undefined;

(async () => {
  let githubToken = process.env.GITHUB_TOKEN;
  let npmToken = process.env.NPM_TOKEN;

  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the changesets action");
    return;
  }

  console.log("setting git user");
  await gitUtils.setupUser();

  console.log("setting GitHub credentials");
  await fs.writeFile(
    `${process.env.HOME}/.netrc`,
    `machine github.com\nlogin github-actions[bot]\npassword ${githubToken}`
  );

  let { changesets } = await readChangesetState();

  let autoPublish = core.getBooleanInput("autoPublish");
  let hasChangesets = changesets.length !== 0;

  core.setOutput("published", "false");
  core.setOutput("publishedPackages", "[]");
  core.setOutput("hasChangesets", String(hasChangesets));

  if (hasChangesets) {
    await runVersion({
      script: getOptionalInput("version"),
      githubToken,
      prTitle: getOptionalInput("title"),
      commitMessage: getOptionalInput("commit"),
      autoPublish,
    });
  } else {
    console.log("No changesets found");

    if (autoPublish) {
      if (!npmToken) {
        core.setFailed("Please add the NPM_TOKEN to the changesets action");
        return;
      }

      console.log("Attempting to publish any unpublished packages to npm");

      const result = await runPublish({
        npmToken,
        githubToken,
      });

      if (result.published) {
        core.setOutput("published", "true");
        core.setOutput(
          "publishedPackages",
          JSON.stringify(result.publishedPackages),
        );
      }
    }
  }
})().catch((err) => {
  console.error(err);
  core.setFailed(err.message);
});
