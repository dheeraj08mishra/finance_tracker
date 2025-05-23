import { useSelector, useDispatch } from "react-redux";
import Budget from "./Budget";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  addTransaction,
  removeTransaction,
  updateTransaction,
} from "../utils/redux/transactionSlice";
import { db, auth } from "../utils/firebase";
import { setSalary } from "../utils/redux/budgetSlice";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import PieChartCategory from "./PieChartCategory";
import BarChartTrends from "./BarChartTrends";

const MainContainer = () => {
  const dispatch = useDispatch();
  const user = useSelector((store) => store.user.currentUser);
  const transactions = useSelector((store) => store.transaction.transactions);

  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formValues, setFormValues] = useState({
    type: "",
    amount: "",
    category: "",
    note: "",
  });
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  useEffect(() => {
    const fetchTransactionsFromDB = async () => {
      if (!user || transactions.length > 0) return;

      try {
        const q = query(
          collection(db, "users", user.uid, "transactions"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        const transactions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate().toISOString() || null,
        }));

        dispatch(addTransaction(transactions));

        transactions.forEach((transaction) => {
          if (transaction.type === "income") {
            dispatch(setSalary(transaction.amount));
          }
        });
      } catch (err) {
        console.log("Failed to fetch transactions:", err);
      }
    };

    fetchTransactionsFromDB();
  }, [user, transactions.length, dispatch]);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalBalance = totalIncome - totalExpense;

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const handleDeleteTransaction = async (transaction) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const q = query(
          collection(db, "users", user.uid, "transactions"),
          where("id", "==", transaction.id)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          console.warn("No matching document found for deletion.");
          return;
        }
        querySnapshot.forEach(async (docSnap) => {
          await deleteDoc(docSnap.ref);
          toast.success("Transaction deleted successfully!");
          dispatch(removeTransaction(transaction));
        });
      } catch (err) {
        console.log("Error deleting transaction:", err.code, err.message);
      }
    }
  };

  const handleEditTransaction = async (transaction) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const q = query(
          collection(db, "users", user.uid, "transactions"),
          where("id", "==", transaction.id)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          console.warn("No matching document found for editing.");
          return;
        }
        querySnapshot.forEach(async (docSnap) => {
          const docRef = doc(db, "users", user.uid, "transactions", docSnap.id);
          await updateDoc(docRef, {
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            note: transaction.note,
            createdAt: serverTimestamp(),
          });

          toast.success("Transaction updated successfully!");
          dispatch(updateTransaction(transaction));
          if (transaction.type === "income") {
            dispatch(setSalary(transaction.amount));
          }
        });
      } catch (err) {
        console.log("Error updating transaction:", err.code, err.message);
      }
    }
  };

  return (
    <div className="flex flex-col items-center  min-h-screen bg-gray-900 text-white p-4 space-y-8">
      <section className="w-full max-w-6xl space-y-6 mx-auto">
        {/* Center this box */}
        <div className="flex justify-center">
          <div className="bg-gray-700 p-6 rounded-lg shadow-md w-full max-w-md mb-6">
            <h2 className="text-2xl font-bold mb-2">
              💰 Balance: ₹ {totalBalance}
            </h2>
            <div className="flex justify-between text-sm">
              <p>Income: ₹ {totalIncome}</p>
              <p>Expense: ₹ {totalExpense}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-700 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">
              📊 Category Breakdown
            </h3>
            <PieChartCategory />
          </div>

          <div className="bg-gray-700 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">📁 Budget Tracking</h3>
            <Budget />
          </div>
        </div>
      </section>

      {/* Section 2: Bar Chart Trends */}
      <section className="w-full max-w-6xl">
        <div className="bg-gray-700 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">📈 Trends</h3>
          <BarChartTrends />
        </div>
      </section>

      {/* Section 3: Recent Transactions */}
      <section className="w-2/3 max-w-6xl">
        <div className="bg-gray-700 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">📄 Recent Transactions</h3>
          {sortedTransactions.length === 0 ? (
            <p>
              No transactions yet. please add transaction and update Income also
              from Transaction page
            </p>
          ) : (
            <AnimatePresence>
              {sortedTransactions.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="mb-3"
                >
                  {editingTransaction?.id === t.id ? (
                    <div className="p-4 bg-gray-500 text-white rounded-lg shadow space-y-2">
                      <select
                        className="w-full bg-gray-700 p-2 rounded"
                        value={formValues.type}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            type: e.target.value,
                          }))
                        }
                      >
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                      </select>

                      <input
                        className="w-full bg-gray-700 p-2 rounded"
                        type="number"
                        placeholder="Amount"
                        value={formValues.amount}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            amount: +e.target.value,
                          }))
                        }
                      />

                      <input
                        className="w-full bg-gray-700 p-2 rounded"
                        type="text"
                        placeholder="Category"
                        value={formValues.category}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                      />

                      <input
                        className="w-full bg-gray-700 p-2 rounded"
                        type="text"
                        placeholder="Note"
                        value={formValues.note}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                      />

                      <div className="flex gap-3 mt-2">
                        <button
                          className="bg-green-600 px-3 py-1 rounded hover:bg-green-700"
                          onClick={() => {
                            handleEditTransaction({
                              ...editingTransaction,
                              ...formValues,
                            });
                            setEditingTransaction(null);
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="bg-gray-500 px-3 py-1 rounded hover:bg-gray-600"
                          onClick={() => setEditingTransaction(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-600 text-white rounded-lg shadow flex justify-between items-center">
                      <div className="flex items-start gap-3">
                        <div className="text-xl">
                          {t.type === "income" ? "💰" : "💸"}
                        </div>
                        <div>
                          <p className="font-medium text-base">
                            {t.note || "No Note"}{" "}
                            <span className="text-sm text-gray-400">
                              ({t.category})
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(t.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div
                          className={`text-lg font-semibold ${
                            t.type === "income"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {t.type === "income" ? "+" : "-"} ₹{t.amount}
                        </div>
                        <div className="flex gap-2 text-sm text-gray-400">
                          <button
                            className="hover:text-blue-400 transition-colors"
                            onClick={() => {
                              setEditingTransaction(t);
                              setFormValues({
                                type: t.type,
                                amount: t.amount,
                                category: t.category,
                                note: t.note,
                              });
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            className="hover:text-red-400 transition-colors"
                            onClick={() => handleDeleteTransaction(t)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>
    </div>
  );
};

export default MainContainer;
