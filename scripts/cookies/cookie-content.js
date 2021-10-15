require("dotenv").config();
const contentful = require("contentful-management");

/*
 * Align cookie details across England and Scotland
 * There are tables that list all Shelters cookies on both England and Scotland
 * and they need to be have the same content but it is a laborious job to do it manually.
 * This simple (and repetitive) script gets the content from England and updates the corrosponding
 * Scotland content.
 */

const client = contentful.createClient({
  accessToken: process.env.access_token,
});

// England cookie table ids
const ENG_NECESSARY = "QzIoZ6rZeuhI9y9QbTijt";
const ENG_FUNCTIONAL = "1Vjt2mi7lA3hkt4p6KbQ9F";
const ENG_ANALYTICS = "1KzTi1K17kRhX3crebIWjD";
const ENG_MARKETING = "6P2KYnifDcXE4fRMTp1Lzj";

let eng_ne;
let eng_fu;
let eng_an;
let eng_ma;

// Scotland cookie table ids
const SCOT_NECESSARY = "50xK0jghf7OjwK8B0miVVt";
const SCOT_FUNCTIONAL = "cIEHei67uENJhSjL04U6k";
const SCOT_ANALYTICS = "29OmSSos0pIE08aTXdu2X1";
const SCOT_MARKETING = "6gxUouH3Omdq63gatNJORM";

let scot_ne;
let scot_fu;
let scot_an;
let scot_ma;

const getEngContent = async () => {
  client
    .getSpace(process.env.space_id)
    .then((space) => space.getEnvironment(process.env.space_env))
    .then(async (environment) => {
      // Get content form England cookie tables
      Promise.all([
        (eng_ne = await environment.getEntry(ENG_NECESSARY)),
        (eng_fu = await environment.getEntry(ENG_FUNCTIONAL)),
        (eng_an = await environment.getEntry(ENG_ANALYTICS)),
        (eng_ma = await environment.getEntry(ENG_MARKETING)),
      ]).then(() => {
        console.log("Got all England content");
      });
    })
    .catch(console.error);
};

const updateScotContent = async () => {
  client
    .getSpace(process.env.space_id_scotland)
    .then((space) => space.getEnvironment(process.env.space_env_scotland))
    .then(async (environment) => {
      Promise.all([
        (scot_ne = await environment.getEntry(SCOT_NECESSARY)),
        (scot_fu = await environment.getEntry(SCOT_FUNCTIONAL)),
        (scot_an = await environment.getEntry(SCOT_ANALYTICS)),
        (scot_ma = await environment.getEntry(SCOT_MARKETING)),
      ]).then(async () => {
        // Set content of Scotland cookie tables to the same as that of England
        scot_ne.fields = eng_ne.fields;
        await scot_ne.update();

        scot_fu.fields = eng_fu.fields;
        await scot_fu.update();

        scot_an.fields = eng_an.fields;
        await scot_an.update();

        scot_ma.fields = eng_ma.fields;
        await scot_ma.update();

        console.log("Set all Scotland content to that of England");
      });
    })
    .catch(console.error);
};

(async () => {
  await getEngContent();
  await updateScotContent();
})();
