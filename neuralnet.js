import * as tf from "@tensorflow/tfjs";
import * as tfvis from "@tensorflow/tfjs-vis";
import * as Papa from "papaparse";
import * as Plotly from "plotly.js-dist";
import _ from "lodash";

Papa.parsePromise = function(file) {
  return new Promise(function(complete, error) {
    Papa.parse(file, {
      header: true,
      download: true,
      dynamicTyping: true,
      complete,
      error
    });
  });
};

const prepareData = async () => {
  const csv = await Papa.parsePromise(
    "https://raw.githubusercontent.com/curiousily/Customer-Churn-Detection-with-TensorFlow-js/master/src/data/customer-churn.csv"
  );

  const data = csv.data;
  return data.slice(0, data.length - 1);
};

const renderHistogram = (container, data, column, config) => {
  const defaulted = data.filter(r => r["Churn"] === "Yes").map(r => r[column]);
  const paid = data.filter(r => r["Churn"] === "No").map(r => r[column]);

  const dTrace = {
    name: "Churned",
    x: defaulted,
    type: "histogram",
    opacity: 0.35,
    marker: {
      color: "mediumvioletred"
    }
  };

  const hTrace = {
    name: "Retained",
    x: paid,
    type: "histogram",
    opacity: 0.35,
    marker: {
      color: "dodgerblue"
    }
  };

  Plotly.newPlot(container, [dTrace, hTrace], {
    barmode: "overlay",
    xaxis: {
      title: config.xLabel
    },
    yaxis: { title: "Count" },
    title: config.title
  });
};

const renderChurn = data => {
  const churns = data.map(r => r["Churn"]);

  const [churned, retained] = _.partition(churns, o => o === "Yes");

  const chartData = [
    {
      labels: ["Churned", "Retained"],
      values: [churned.length, retained.length],
      type: "pie",
      opacity: 0.6,
      marker: {
        colors: ["mediumvioletred", "dodgerblue"]
      }
    }
  ];

  Plotly.newPlot("churn-cont", chartData, {
    title: "Churned vs Retained payment"
  });
};

const renderSexChurn = data => {
  const churned = data.filter(r => r["Churn"] === "Yes");
  const retained = data.filter(r => r["Churn"] === "No");

  const [dMale, dFemale] = _.partition(churned, s => s.gender === "Male");
  const [pMale, pFemale] = _.partition(retained, b => b.gender === "Male");

  var sTrace = {
    x: ["Male", "Female"],
    y: [dMale.length, dFemale.length],
    name: "Churned",
    type: "bar",
    opacity: 0.6,
    marker: {
      color: "mediumvioletred"
    }
  };

  var bTrace = {
    x: ["Male", "Female"],
    y: [pMale.length, pFemale.length],
    name: "Retained",
    type: "bar",
    opacity: 0.6,
    marker: {
      color: "dodgerblue"
    }
  };

  Plotly.newPlot("sex-churn-cont", [sTrace, bTrace], {
    barmode: "group",
    title: "Sex vs Churn Status"
  });
};

const renderSeniorChurn = data => {
  const churned = data.filter(r => r["Churn"] === "Yes");
  const retained = data.filter(r => r["Churn"] === "No");

  const [dMale, dFemale] = _.partition(churned, s => s.SeniorCitizen === 1);
  const [pMale, pFemale] = _.partition(retained, b => b.SeniorCitizen === 1);

  var sTrace = {
    x: ["Senior", "Non senior"],
    y: [dMale.length, dFemale.length],
    name: "Churned",
    type: "bar",
    opacity: 0.6,
    marker: {
      color: "mediumvioletred"
    }
  };

  var bTrace = {
    x: ["Senior", "Non senior"],
    y: [pMale.length, pFemale.length],
    name: "Retained",
    type: "bar",
    opacity: 0.6,
    marker: {
      color: "dodgerblue"
    }
  };

  Plotly.newPlot("senior-churn-cont", [sTrace, bTrace], {
    barmode: "group",
    title: "Senior vs Churn Status"
  });
};

// normalized = (value ??? min_value) / (max_value ??? min_value)
const normalize = tensor =>
  tf.div(
    tf.sub(tensor, tf.min(tensor)),
    tf.sub(tf.max(tensor), tf.min(tensor))
  );

const oneHot = (val, categoryCount) =>
  Array.from(tf.oneHot(val, categoryCount).dataSync());

const toCategorical = (data, column) => {
  const values = data.map(r => r[column]);
  const uniqueValues = new Set(values);

  const mapping = {};

  Array.from(uniqueValues).forEach((i, v) => {
    mapping[i] = v;
  });

  const encoded = values
    .map(v => {
      if (!v) {
        return 0;
      }
      return mapping[v];
    })
    .map(v => oneHot(v, uniqueValues.size));

  return encoded;
};

const toTensors = (data, categoricalFeatures, testSize) => {
  const categoricalData = {};
  categoricalFeatures.forEach(f => {
    categoricalData[f] = toCategorical(data, f);
  });

  const features = [
    "SeniorCitizen",
    "tenure",
    "MonthlyCharges",
    "TotalCharges"
  ].concat(Array.from(categoricalFeatures));

  const X = data.map((r, i) =>
    features.flatMap(f => {
      if (categoricalFeatures.has(f)) {
        return categoricalData[f][i];
      }

      return r[f];
    })
  );

  const X_t = normalize(tf.tensor2d(X));
  const y = tf.tensor(toCategorical(data, "Churn"));

  const splitIdx = parseInt((1 - testSize) * data.length, 10);

  const [xTrain, xTest] = tf.split(X_t, [splitIdx, data.length - splitIdx]);
  const [yTrain, yTest] = tf.split(y, [splitIdx, data.length - splitIdx]);

  return [xTrain, xTest, yTrain, yTest];
};

const trainModel = async (xTrain, yTrain) => {

  //A sequential model is any model where the outputs of one layer are the inputs to the next layer,
  // i.e. the model topology is a simple 'stack' of layers, with no branching or skipping....
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 32,
      activation: "relu",
        //add a layer with 32 neurons
      inputShape: [xTrain.shape[1]]
    })
  );

  //add a layer with 64 neurons
  model.add(
    tf.layers.dense({
      units: 64,
      activation: "relu"
    })
  );

  //add a layer with 2 neurons
  model.add(tf.layers.dense({ units: 2, activation: "softmax" }));

   //Configures and prepares the model for training and evaluation.
  model.compile({
    //modifies The attributes of the neural network, such as weights and learning rate.
    //Thus, it helps in reducing the overall loss and improve the accuracy
    optimizer: tf.train.adam(0.001),
    //loss metic that compares how close or far from the actual value
    loss: "binaryCrossentropy",
    //metrics to be evaluated by the model during training and testin
    metrics: ["accuracy"]
  });

  const lossContainer = document.getElementById("loss-cont");

  // Trains the model for a fixed number of epochs (iterations on a dataset).
  await model.fit(xTrain, yTrain, {
    // batch size defines the number of samples that will be propagated through the network.
    batchSize: 32,
    epochs: 32,
    shuffle: true,
    // fraction of the training data to be used as validation data.
    // The model will set apart this fraction of the training data, will not train on it,
    validationSplit: 0.1,
    callbacks: tfvis.show.fitCallbacks(
      lossContainer,
      ["loss", "val_loss", "acc", "val_acc"],
      {
        callbacks: ["onEpochEnd"]
      }
    )
  });

  return model;
};

const run = async () => {
  const data = await prepareData();

  renderChurn(data);
  renderSexChurn(data);
  renderSeniorChurn(data);

  renderHistogram("tenure-cont", data, "tenure", {
    title: "Tenure duration",
    xLabel: "Tenure (months)"
  });

  renderHistogram("monthly-charges-cont", data, "MonthlyCharges", {
    title: "Amount charged monthly",
    xLabel: "Amount (USD)"
  });

  renderHistogram("total-charges-cont", data, "TotalCharges", {
    title: "Total amount charged",
    xLabel: "Amount (USD)"
  });

  const categoricalFeatures = new Set([
    "TechSupport",
    "Contract",
    "PaymentMethod",
    "gender",
    "Partner",
    "InternetService",
    "Dependents",
    "PhoneService",
    "TechSupport",
    "StreamingTV",
    "PaperlessBilling"
  ]);

  const [xTrain, xTest, yTrain, yTest] = toTensors(
    data,
    categoricalFeatures,
    0.1
  );

  const model = await trainModel(xTrain, yTrain);

  // Returns the loss value & metrics values for the model in test mode.
  const result = model.evaluate(xTest, yTest, {
    batchSize: 32
  });
  result[0].print();
  result[1].print();



  //prediction
  const preds = model.predict(xTest).argMax(-1);
  const labels = yTest.argMax(-1);

  //A confusion matrix presents a table layout of the different outcomes of the prediction
  //and results of a classification problem and helps visualize its outcomes
  const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds);
  const container = document.getElementById("confusion-matrix");
  tfvis.render.confusionMatrix(container, {
    values: confusionMatrix,
    tickLabels: ["Retained", "Churned"]
  });
};

if (document.readyState !== "loading") {
  run();
} else {
  document.addEventListener("DOMContentLoaded", run);
}