const contentful = require("contentful-management");
const axios = require("axios");
require("dotenv").config();

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse";
const DATA_CONTENT_TYPE = "dataCourse";
const GRAPHQL_ENDPOINT = "http://localhost:8000/__graphql";

const createMetaInfo = async (environment, templateName) => {
  try {
    const metainfoEntry = await environment.createEntry(
      "topicPageMetaInformation",
      {
        fields: {
          systemName: { "en-GB": templateName },
          seoDescription: { "en-GB": `SEO description for ${templateName}` },
          shortDescription: {
            "en-GB": `Short description for ${templateName}`,
          },
        },
      }
    );

    console.log(`Created topicPageMetaInformation entry for ${templateName}`);
    return metainfoEntry;
  } catch (error) {
    throw new Error(
      `Error creating topicPageMetaInformation entry for ${templateName}: ${error.message}`
    );
  }
};

const linkDataAndTopicToPageCourse = async (pageEntry, dataEntry, metainfoEntry) => {
  try {
    const {
      fields: {
        title,
      },
    } = pageEntry;

    if (!dataEntry || !metainfoEntry) {
      throw new Error(`Cannot link empty data or topic entry for ${title["en-GB"]}`);
    }

    // Link dataCourse to pageCourse
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

    // Link topicPageMetaInformation to pageCourse
    if (!pageEntry.fields.pageInformation) {
      pageEntry.fields.pageInformation = {};
    }

    pageEntry.fields.pageInformation["en-GB"] = {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: metainfoEntry.sys.id,
      },
    };

    await pageEntry.update();

    console.log(`Linked dataCourse and topicPageMetaInformation to pageCourse entry: ${title["en-GB"]}`);
  } catch (error) {
    throw new Error(`Error linking dataCourse and topicPageMetaInformation to pageCourse entry: ${error.message}`);
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

    if (space === 'master') {
      console.log("Attempting to update entries on master env, are you sure?");
      return
    }

    const { existingPageEntries, existingDataEntries } = await fetchExistingEntries(environment);

    const existingPageSlugs = existingPageEntries?.items?.map((entry) => entry.fields.slug["en-GB"]) ?? [];
    const existingTemplateIdStrings = existingDataEntries?.items?.map((entry) => entry.fields.templateIdString["en-GB"]) ?? [];

    for (const course of courses) {
      const { templateName, templateIdString } = course;
  
      if (existingPageSlugs.includes(templateIdString) || existingTemplateIdStrings.includes(templateIdString)) {
        console.log(
          `Entry with templateIdString "${templateIdString}" already exists. Skipping.`
        );
        continue;
      }
  
      try {
        const pageEntry = await createPageEntry(
          environment,
          templateName,
          templateIdString
        );
  
        const dataEntry = await createDataEntry(
          environment,
          templateName,
          templateIdString
        );
  
        const metainfoEntry = await createMetaInfo(
          environment,
          templateName
        );
  
        await linkDataAndTopicToPageCourse(
          pageEntry,
          dataEntry,
          metainfoEntry
        );
  
      } catch (error) {
        console.error(
          `Error creating/linking entries for ${templateName}: ${error.message}`
        );
      }
    }
  
    console.log("All entries created and linked.");
  } catch (error) {
    console.error(`Error creating entries: ${error.message}`);
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
