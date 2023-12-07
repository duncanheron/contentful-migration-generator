const contentful = require("contentful-management");
const axios = require("axios");
require("dotenv").config();

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse";
const DATA_CONTENT_TYPE = "dataCourse";
const META_INFO_TYPE = "topicPageMetaInformation";
const GRAPHQL_ENDPOINT = "http://localhost:8000/__graphql";

const createContentfulEntry = async (environment, contentType, fields) => {
  try {
    const entry = await environment.createEntry(contentType, fields);
    console.log(`Created entry for ${contentType}`);
    return entry;
  } catch (error) {
    throw new Error(
      `Error creating entry for ${contentType}: ${error.message}`
    );
  }
};

const linkDataAndTopicToPageCourse = async (
  pageEntry,
  dataEntry,
  metaInfoEntry
) => {
  try {
    const {
      fields: { title },
    } = pageEntry;

    console.log("Page Entry:", pageEntry);
    console.log("Data Entry:", dataEntry);
    console.log("Meta Info Entry:", metaInfoEntry);

    if (!dataEntry || !metaInfoEntry) {
      throw new Error(
        `Cannot link empty data or topic entry for ${title["en-GB"]}`
      );
    }

    if (!pageEntry.fields.course) {
      pageEntry.fields.course = {};
    }

    pageEntry.fields.course["en-GB"] = {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: dataEntry.sys.id,
      },
    };

    if (!pageEntry.fields.pageInformation) {
      pageEntry.fields.pageInformation = {};
    }

    pageEntry.fields.pageInformation["en-GB"] = {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: metaInfoEntry.sys.id,
      },
    };

    await pageEntry.update();

    console.log(
      `Linked dataCourse and topicPageMetaInformation to pageCourse entry: ${title["en-GB"]}`
    );
  } catch (error) {
    throw new Error(
      `Error linking dataCourse and topicPageMetaInformation to pageCourse entry: ${error.message}`
    );
  }
};

const fetchExistingEntries = async (environment) => {
  try {
    const existingPageEntries = await environment.getEntries({
      content_type: PAGE_CONTENT_TYPE,
    });

    const existingDataEntries = await environment.getEntries({
      content_type: DATA_CONTENT_TYPE,
    });

    return {
      existingPageEntries,
      existingDataEntries,
    };
  } catch (error) {
    throw new Error(`Error fetching existing entries: ${error.message}`);
  }
};

const createEntries = async (courses) => {
  const client = contentful.createClient({
    accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
  });

  try {
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);

    if (space === "master") {
      console.log("Attempting to update entries on master env, are you sure?");
      return;
    }

    const {
      existingPageEntries,
      existingDataEntries,
    } = await fetchExistingEntries(environment);

    // console.log(existingDataEntries);
    console.log(existingPageEntries.items[0].fields);

    // const existingPageSlugs =
    //   existingPageEntries?.items?.map((entry) => entry.fields.slug["en-GB"]) ??
    //   [];

    const existingPageSlugs =
      existingPageEntries?.items?.map(
        (entry) => entry.fields.slug?.["en-GB"] ?? undefined
      ) ?? [];

    console.log(existingPageSlugs);
    const existingTemplateIdStrings =
      existingDataEntries?.items?.map(
        (entry) => entry.fields.templateIdString["en-GB"] ?? undefined
      ) ?? [];
    console.log(existingTemplateIdStrings);
    for (const course of courses) {
      const { templateName, templateIdString } = course;

      if (
        existingPageSlugs.includes(templateIdString) ||
        existingTemplateIdStrings.includes(templateIdString)
      ) {
        console.log(
          `Entry with templateIdString "${templateIdString}" already exists. Skipping.`
        );
        continue;
      }

      try {
        const pageEntry = await createContentfulEntry(
          environment,
          PAGE_CONTENT_TYPE,
          {
            fields: {
              title: { "en-GB": templateName },
              slug: { "en-GB": templateIdString },
            },
          }
        );

        const dataEntry = await createContentfulEntry(
          environment,
          DATA_CONTENT_TYPE,
          {
            fields: {
              name: { "en-GB": templateName },
              templateIdString: { "en-GB": templateIdString },
            },
          }
        );

        const metaInfoEntry = await createContentfulEntry(
          environment,
          META_INFO_TYPE,
          {
            fields: {
              systemName: { "en-GB": templateName },
              seoDescription: {
                "en-GB": `SEO description for ${templateName}`,
              },
              shortDescription: {
                "en-GB": `Short description for ${templateName}`,
              },
            },
          }
        );

        await linkDataAndTopicToPageCourse(pageEntry, dataEntry, metaInfoEntry);
      } catch (error) {
        console.error(
          `Error creating/linking entries for ${templateName}: ${error.message}`
        );
      }
    }

  } catch (error) {
    console.error(`Error creating entries: ${error.message}`);
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createEntriesInBatches = async (courses) => {
  const batchSize = 10;
  const delayBetweenBatches = 2000;

  for (let i = 0; i < courses.length; i += batchSize) {
    const batch = courses.slice(i, i + batchSize);

    await createEntries(batch);

    if (i + batchSize < courses.length) {
      console.log(`Waiting for ${delayBetweenBatches} ms before next batch...`);
      await delay(delayBetweenBatches);
    }
  }
};

const fetchData = async () => {
  try {
    const query = `
      query {
        allCourseTemplate {
          nodes {
            templateName
            templateIdString
          }
        }
      }
    `;

    const response = await axios.post(GRAPHQL_ENDPOINT, { query });

    if (response.data && response.data.data) {
      const courses = response.data.data.allCourseTemplate.nodes;
      await createEntriesInBatches(courses);
    } else {
      throw new Error("No data found in the response.");
    }
  } catch (error) {
    console.error(error);
  }
};

fetchData();
