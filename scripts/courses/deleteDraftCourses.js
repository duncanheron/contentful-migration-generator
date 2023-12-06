// Probably no need to keep this script but it's handy in development
const contentful = require("contentful-management");
require("dotenv").config();

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse";
const DATA_CONTENT_TYPE = "dataCourse";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const deleteDraftCourseEntries = async () => {
    const client = contentful.createClient({
      accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
    });
  
    try {
      const space = await client.getSpace(CONTENTFUL_SPACE_ID);
      const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);
  
      if (space === 'master') {
        console.log("Attempting to delete entries on master env, are you sure?");
        return
      }
  
      const query = {
        'sys.publishedAt[exists]': false,
      };
  
      const pageCourseEntries = await environment.getEntries({
        content_type: PAGE_CONTENT_TYPE,
        ...query,
      });
  
      const dataCourseEntries = await environment.getEntries({
        content_type: DATA_CONTENT_TYPE,
        ...query,
      });
  
      const deleteEntriesWithDelay = async (entries) => {
        for (const entry of entries) {
          try {
            await entry.delete();
            console.log(`Deleted draft entry with ID: ${entry.sys.id}`);
          } catch (error) {
            console.error(`Error deleting draft entry with ID ${entry.sys.id}: ${error.message}`);
          }
          await delay(600);
        }
      };
  
      // Deleting pageCourse entries with a delay
      await deleteEntriesWithDelay(pageCourseEntries.items);
  
      // Wait before starting to delete dataCourse entries
      await delay(2000);
  
      // Deleting dataCourse entries with a delay
      await deleteEntriesWithDelay(dataCourseEntries.items);
  
      console.log('All draft pageCourse and dataCourse entries have been deleted.');
    } catch (error) {
      console.error(`Error deleting entries: ${error.message}`);
    }
  };
  
  deleteDraftCourseEntries();