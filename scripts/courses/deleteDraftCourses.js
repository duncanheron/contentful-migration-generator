// Probably no need to keep this script but it's handy in development
const contentful = require("contentful-management");
const readlineSync = require("readline-sync");
require("dotenv").config();

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse";
const DATA_CONTENT_TYPE = "dataCourse";
const META_INFO_TYPE = "topicPageMetaInformation";


// TODO - pagination seems to be broken. May need to be run multiple times to delete all entries

// THIS WILL DELETE ALL topicPageMetaInformation ENTRIES,
// NOT JUST THOSE RELATED TO COURSES
// THIS WILL CAUSE PROBLEMS IF YOU RUN IT ON MASTER ENV!

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


const promptEnvironment = () => {

  if(CONTENTFUL_ENVIRONMENT === 'master') {
    console.error('Running this on master env is not advised. All topicPageMetaInformation entries will be deleted - not just those related to courses.')
    return;
  }

  const userEnvironment = readlineSync.question(
    `All topicPageMetaInformation entries will be deleted - not just those related to courses. Current CONTENTFUL_ENVIRONMENT value is "${CONTENTFUL_ENVIRONMENT}". Is this ok? (Y/N): `
  );

  if (userEnvironment.toUpperCase() !== "Y") {
    console.log(
      "Please update the CONTENTFUL_ENVIRONMENT value in the script before proceeding."
    );
    process.exit(1);
  }
};


const deleteDraftCourseEntries = async () => {

  promptEnvironment();

  const client = contentful.createClient({
    accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
  });

  try {
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);

    if (environment === "master") {
      console.log("Attempting to delete entries on master env, are you sure?");
      return;
    }

    const query = {
      "sys.publishedAt[exists]": false,
    };

    const pageCourseEntries = await environment.getEntries({
      content_type: PAGE_CONTENT_TYPE,
      ...query,
    });

    const dataCourseEntries = await environment.getEntries({
      content_type: DATA_CONTENT_TYPE,
      ...query,
    });

    const metaInfoEntries = await environment.getEntries({
      content_type: META_INFO_TYPE,
      ...query,
    });

    const deleteEntriesInBatches = async (contentType, skip = 0, totalDeleted = 0) => {
      const pageSize = 100;
    
      try {
        while (true) {
          const entries = await environment.getEntries({
            content_type: contentType,
            ...query,
            skip,
            limit: pageSize,
          });
    
          if (entries.items.length === 0) {
            console.log(`Total ${contentType} entries deleted: ${totalDeleted}`);
            return totalDeleted;
          }
    
          for (const entry of entries.items) {
            try {
              await entry.delete();
              console.log(`Deleted draft entry with ID: ${entry.sys.id}`);
              totalDeleted++;
            } catch (error) {
              console.error(
                `Error deleting draft entry with ID ${entry.sys.id}: ${error.message}`
              );
            }
            await delay(600);
          }
    
          skip += pageSize; // Update skip for the next batch
        }
      } catch (error) {
        throw new Error(`Error deleting ${contentType} entries: ${error.message}`);
      }
    };

    // const deleteEntriesInBatches = async (contentType) => {
    //   const pageSize = 100;
    //   let skip = 0;
    //   let totalDeleted = 0;
    //   let hasMoreEntries = true;

    //   while (hasMoreEntries) {
    //     const entries = await environment.getEntries({
    //       content_type: contentType,
    //       ...query,
    //       skip,
    //       limit: pageSize,
    //     });

    //     if (entries.items.length === 0) {
    //       hasMoreEntries = false;
    //       break;
    //     }

    //     for (const entry of entries.items) {
    //       try {
    //         await entry.delete();
    //         console.log(`Deleted draft entry with ID: ${entry.sys.id}`);
    //         totalDeleted++;
    //       } catch (error) {
    //         console.error(
    //           `Error deleting draft entry with ID ${entry.sys.id}: ${error.message}`
    //         );
    //       }
    //       await delay(600);
    //     }

    //     skip += pageSize;

    //     await delay(2000); // Wait before fetching the next batch
    //   }

    //   return totalDeleted;
    // };

    const pageCourseDeleted = await deleteEntriesInBatches(PAGE_CONTENT_TYPE);
    const dataCourseDeleted = await deleteEntriesInBatches(DATA_CONTENT_TYPE);
    const metaInfoDeleted = await deleteEntriesInBatches(META_INFO_TYPE);

    console.log(`Total draft pageCourse entries deleted: ${pageCourseDeleted}`);
    console.log(`Total draft dataCourse entries deleted: ${dataCourseDeleted}`);
    console.log(`Total draft metaInfo entries deleted: ${metaInfoDeleted}`);

    console.log(
      "All draft pageCourse, dataCourse and entries have been deleted."
    );
  } catch (error) {
    console.error(`Error deleting entries: ${error.message}`);
  }
};

deleteDraftCourseEntries();
