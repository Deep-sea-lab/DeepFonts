import { fontSplit } from "cn-font-split";
import workerpool from "workerpool";
// create a worker and register public functions
workerpool.worker({
    fibonacci(config) {
        return fontSplit(config);
    },
});
