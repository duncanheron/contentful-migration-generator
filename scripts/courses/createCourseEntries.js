const contentful = require("contentful-management");
const axios = require("axios");
require("dotenv").config();

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse";
const DATA_CONTENT_TYPE = "dataCourse";
const META_INFO_TYPE = "topicPageMetaInformation";
const GRAPHQL_ENDPOINT = "http://[::1]:8000/___graphql"; // try `http://localhost:8000/___graphql` if this gives a `ECONNREFUSED` error - see readme

let environment;

// Initialises the CMA and sets the environment in the top scope
const initCMA = async () => {
  const client = contentful.createClient({
    accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
  });
  const space = await client.getSpace(CONTENTFUL_SPACE_ID);
  environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);
};

const createContentfulEntry = async (contentType, fields) => {
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

// Takes page, data, and meta info entries and links them together within the page entry's fields.
const linkDataAndTopicToPageCourse = async (
  pageEntry,
  dataEntry,
  metaInfoEntry
) => {
  try {
    const {
      fields: { title },
    } = pageEntry;

    if (!dataEntry || !metaInfoEntry) {
      throw new Error(
        `Cannot link empty data or topic entry for ${title["en-GB"]}`
      );
    }

    // If the course field isn't found, set it to be an empty object
    if (!pageEntry.fields.course) {
      pageEntry.fields.course = {};
    }

    // Link the data - course entry
    pageEntry.fields.course["en-GB"] = {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: dataEntry.sys.id,
      },
    };

    // If the meta info field isn't found, set it to be an empty object
    if (!pageEntry.fields.pageInformation) {
      pageEntry.fields.pageInformation = {};
    }

    // Link the component - topicPageMetaInformation
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

// Retrieves all existing entries for page and data content types using pagination and returns the accumulated entries.
const fetchExistingEntries = async () => {
  try {
    const limit = 100;
    let skip = 0;
    let allPageEntries = [];
    let allDataEntries = [];

    while (true) {
      const pageEntries = await environment.getEntries({
        content_type: PAGE_CONTENT_TYPE,
        skip: skip,
        limit: limit,
      });

      const dataEntries = await environment.getEntries({
        content_type: DATA_CONTENT_TYPE,
        skip: skip,
        limit: limit,
      });

      allPageEntries.push(...pageEntries.items);
      allDataEntries.push(...dataEntries.items);
      skip += limit;

      // Break the loop if either pageEntries or dataEntries is less than the limit
      if (
        pageEntries.items.length < limit ||
        dataEntries.items.length < limit
      ) {
        break;
      }
    }
    return {
      existingPageEntries: allPageEntries,
      existingDataEntries: allDataEntries,
    };
  } catch (error) {
    throw new Error(`Error fetching existing entries: ${error.message}`);
  }
};

// Compares the provided courses with existing entries and creates new entries only if they don't already exist.
const createEntries = async (courses) => {
  try {
    const {
      existingPageEntries,
      existingDataEntries,
    } = await fetchExistingEntries();

    // Extracts the 'slug' field values from existing page entries and creates an array of slugs.
    // Defaults to an empty array if no slugs are found
    const existingPageSlugs =
      existingPageEntries?.map((entry) => entry.fields.slug?.["en-GB"]) ?? [];

    // As existingPageSlugs but for the data entry's templateIdString value
    const existingTemplateIdStrings =
      existingDataEntries?.map(
        (entry) => entry.fields.templateIdString?.["en-GB"]
      ) ?? [];

    // Loop through the courses, check if an entry with the slug or templateIdString exists, create an entry if it does not
    for (const course of courses) {
      const { templateName, templateIdString } = course;

      const pageEntryExists = existingPageSlugs.includes(templateIdString);
      const dataEntryExists = existingTemplateIdStrings.includes(
        templateIdString
      );

      let pageEntry;
      let dataEntry;
      let metaInfoEntry;

      if (pageEntryExists && dataEntryExists) {
        console.log(
          `Entry with templateIdString "${templateIdString}" already exists. Skipping.`
        );
        continue;
      }

      try {
        // If the page entry exists use it, if it doesn't create a new one
        if (!pageEntryExists) {
          pageEntry = await createContentfulEntry(PAGE_CONTENT_TYPE, {
            fields: {
              title: { "en-GB": templateName },
              slug: { "en-GB": templateIdString },
            },
          });
        } else {
          const existingEntry = await space.getEntries({
            content_type: PAGE_CONTENT_TYPE,
            "fields.slug.en-GB": templateIdString,
            limit: 1,
          });

          pageEntry = existingEntry.items[0];
        }
        // If the page doesn't have a data entry associated with it create one and link it to the page entry
        if (!pageEntry.fields.course) {
          dataEntry = await createContentfulEntry(DATA_CONTENT_TYPE, {
            fields: {
              name: { "en-GB": templateName },
              templateIdString: { "en-GB": templateIdString },
            },
          });

          pageEntry.fields.course["en-GB"] = {
            sys: {
              type: "Link",
              linkType: "Entry",
              id: dataEntry.sys.id,
            },
          };
        }

        // If the page doesn't have a metadata entry associated with it
        if (!pageEntry.fields.pageInformation) {
          metaInfoEntry = await createContentfulEntry(META_INFO_TYPE, {
            fields: {
              systemName: { "en-GB": templateName },
              seoDescription: {
                "en-GB": `SEO description for ${templateName}`,
              },
              shortDescription: {
                "en-GB": `Short description for ${templateName}`,
              },
            },
          });

          pageEntry.fields.pageInformation["en-GB"] = {
            sys: {
              type: "Link",
              linkType: "Entry",
              id: metaInfoEntry.sys.id,
            },
          };
        }
        // await linkDataAndTopicToPageCourse(pageEntry, dataEntry, metaInfoEntry);
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

// Calls createEntries 10 entries at a time to avoid rate limits
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

// Fetches the data from the grapql endpoint
const fetchData = async () => {
  try {
    await initCMA();
  } catch (error) {
    console.error(`Couldn't initialise CMA: ${error}`);
  }

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
