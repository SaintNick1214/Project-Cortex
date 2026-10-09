import type {
  CatalogTemplate as ProducerTemplate,
  TemplateCatalog as ProducerCatalog,
  PayloadFile as ProducerFile,
} from "../contract.js";
import type {
  CatalogTemplate as ConsumerTemplate,
  TemplateCatalog as ConsumerCatalog,
  PayloadFile as ConsumerFile,
} from "../../cortex-cli/src/utils/templates/contract.js";

type Equal<A, B> = A extends B ? (B extends A ? true : false) : false;
const template: Equal<ProducerTemplate, ConsumerTemplate> = true;
const catalog: Equal<ProducerCatalog, ConsumerCatalog> = true;
const file: Equal<ProducerFile, ConsumerFile> = true;
void [template, catalog, file];
