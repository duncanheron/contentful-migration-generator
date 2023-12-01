const contentful = require("contentful-management");
const axios = require("axios");
require("dotenv").config();

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse";
const DATA_CONTENT_TYPE = "dataCourse";
const GRAPHQL_ENDPOINT = "http://localhost:8000/__graphql";

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

const createPageEntry = async (environment, templateName, templateIdString) => {
  try {
    const pageEntry = await environment.createEntry(PAGE_CONTENT_TYPE, {
      fields: {
        title: { "en-GB": templateName },
        slug: { "en-GB": templateIdString },
      },
    });

    console.log(`Created page entry for ${templateName}`);
    return pageEntry;
  } catch (error) {
    throw new Error(
      `Error creating page entry for ${templateName}: ${error.message}`
    );
  }
};

const createDataEntry = async (environment, title, templateIdString) => {
  try {
    const dataEntry = await environment.createEntry(DATA_CONTENT_TYPE, {
      fields: {
        name: { "en-GB": title },
        templateIdString: { "en-GB": templateIdString },
      },
    });

    console.log(`Created data entry for ${title}`);
    return dataEntry;
  } catch (error) {
    throw new Error(`Error creating data entry for ${title}: ${error.message}`);
  }
};

const createEntries = async (courses) => {
  const client = contentful.createClient({
    accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
  });

  try {
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);

    const {
      existingPageEntries,
      existingDataEntries,
    } = await fetchExistingEntries(environment);

    const existingPageSlugs =
      existingPageEntries?.items?.map((entry) => entry.fields.slug["en-GB"]) ??
      [];

    const existingTemplateIdStrings =
      existingDataEntries?.items?.map(
        (entry) => entry.fields.templateIdString["en-GB"]
      ) ?? [];

    const pageCreationPromises = courses.map(async (course) => {
      const { templateName, templateIdString } = course;

      if (existingPageSlugs.includes(templateIdString)) {
        console.log(
          `Page entry with slug "${templateIdString}" already exists. Skipping.`
        );
        return null;
      }

      try {
        return await createPageEntry(
          environment,
          templateName,
          templateIdString
        );
      } catch (error) {
        console.error(
          `Error creating page entry for ${templateName}: ${error.message}`
        );
        return null;
      }
    });

    const createdPageEntries = (await Promise.all(pageCreationPromises)).filter(
      (entry) => entry !== null
    );

    console.log("All page entries created.");

    const dataCreationPromises = [];

    for (const pageEntry of createdPageEntries) {
      const {
        fields: {
          slug: { "en-GB": templateIdString },
          title,
        },
      } = pageEntry;

      if (existingTemplateIdStrings.includes(templateIdString)) {
        console.log(
          `Data entry with templateIdString "${templateIdString}" already exists. Skipping.`
        );
        continue;
      }

      const dataCreationPromise = createDataEntry(
        environment,
        title["en-GB"],
        templateIdString
      );
      dataCreationPromises.push(dataCreationPromise);
    }

    const createdDataEntries = await Promise.all(dataCreationPromises);

    for (let i = 0; i < createdPageEntries.length; i++) {
      const pageEntry = createdPageEntries[i];
      const dataEntry = createdDataEntries[i];

      const {
        sys: { id: pageCourseId },
      } = pageEntry;

      const pageCourse = await environment.getEntry(pageCourseId);

      if (!pageCourse.fields.course) {
        pageCourse.fields.course = {};
      }

      pageCourse.fields.course["en-GB"] = {
        sys: {
          type: "Link",
          linkType: "Entry",
          id: dataEntry.sys.id,
        },
      };

      await pageCourse.update();

      console.log(
        `Linked dataCourse entry to pageCourse entry: ${pageEntry.fields.title["en-GB"]}`
      );
    }

    console.log("All dataCourse entries linked to pageCourse entries.");
  } catch (error) {
    console.error(`Error creating/linking entries: ${error.message}`);
  }
};


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createEntriesInBatches = async (courses) => {
  // These numbers are quite conservative yet we still see some warnings in the console
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
