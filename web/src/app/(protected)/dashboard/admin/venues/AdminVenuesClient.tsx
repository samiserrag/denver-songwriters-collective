"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface VenueSubmission {
  id: string;
  name: string;
  address?: string;
  city?: string;
  status: string;
  submitted_by: string;
  created_at: string;
  rejection_reason?: string;
  submitter?: { email: string };
}

interface Venue {
  canonical_id: string;
  name: string;
  address?: string;
  city?: string;
}

export default function AdminVenuesClient() {
  const [submissions, setSubmissions] = useState<VenueSubmission[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"submissions" | "venues">("submissions");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // New venue form
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({ name: "", address: "", city: "Denver" });

  const supabase = createSupabaseBrowserClient();

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchSubmissions = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-venues/submissions`,
        { headers }
      );
      if (!res.ok) throw new Error("Failed to fetch submissions");
      const data = await res.json();
      setSubmissions(data);
    } catch (err) {
      setError("Failed to load submissions");
      console.error(err);
    }
  };

  const fetchVenues = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-venues/venues`,
        { headers }
      );
      if (!res.ok) throw new Error("Failed to fetch venues");
      const data = await res.json();
      setVenues(data);
    } catch (err) {
      setError("Failed to load venues");
      console.error(err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSubmissions(), fetchVenues()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-venues/approve/${id}`,
        { method: "POST", headers }
      );
      if (!res.ok) throw new Error("Failed to approve");
      await Promise.all([fetchSubmissions(), fetchVenues()]);
    } catch (err) {
      alert("Failed to approve submission");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Rejection reason (optional):");
    setActionLoading(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-venues/reject/${id}`,
        { 
          method: "POST", 
          headers,
          body: JSON.stringify({ reason: reason || "Not approved" })
        }
      );
      if (!res.ok) throw new Error("Failed to reject");
      await fetchSubmissions();
    } catch (err) {
      alert("Failed to reject submission");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenue.name.trim()) return;
    
    setActionLoading("new");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-venues/venues`,
        { 
          method: "POST", 
          headers,
          body: JSON.stringify(newVenue)
        }
      );
      if (!res.ok) throw new Error("Failed to create venue");
      await fetchVenues();
      setNewVenue({ name: "", address: "", city: "Denver" });
      setShowNewVenue(false);
    } catch (err) {
      alert("Failed to create venue");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteVenue = async (id: string, name: string) => {
    if (!confirm(`Delete venue "${name}"? This cannot be undone.`)) return;
    
    setActionLoading(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-venues/venues/${id}`,
        { method: "DELETE", headers }
      );
      if (!res.ok) throw new Error("Failed to delete");
      await fetchVenues();
    } catch (err) {
      alert("Failed to delete venue");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  const pendingSubmissions = submissions.filter(s => s.status === "pending");
  const processedSubmissions = submissions.filter(s => s.status !== "pending");

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-2">Venue Management</h1>
      <p className="text-neutral-300 mb-6">Review submissions and manage canonical venues.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-white/10">
        <button
          onClick={() => setActiveTab("submissions")}
          className={`pb-2 px-1 ${
            activeTab === "submissions"
              ? "text-teal-400 border-b-2 border-teal-400"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Submissions ({pendingSubmissions.length} pending)
        </button>
        <button
          onClick={() => setActiveTab("venues")}
          className={`pb-2 px-1 ${
            activeTab === "venues"
              ? "text-teal-400 border-b-2 border-teal-400"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          All Venues ({venues.length})
        </button>
      </div>

      {/* Submissions Tab */}
      {activeTab === "submissions" && (
        <div>
          {pendingSubmissions.length === 0 ? (
            <p className="text-neutral-500">No pending submissions.</p>
          ) : (
            <div className="space-y-4">
              {pendingSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{sub.name}</h3>
                      <p className="text-neutral-400 text-sm">
                        {sub.address && `${sub.address}, `}{sub.city || "No city"}
                      </p>
                      <p className="text-neutral-500 text-xs mt-1">
                        Submitted {new Date(sub.created_at).toLocaleDateString()}
                        {sub.submitter?.email && ` by ${sub.submitter.email}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={actionLoading === sub.id}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-sm disabled:opacity-50"
                      >
                        {actionLoading === sub.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReject(sub.id)}
                        disabled={actionLoading === sub.id}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {processedSubmissions.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-neutral-300 mb-3">
                Previously Processed
              </h2>
              <div className="space-y-2">
                {processedSubmissions.slice(0, 10).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 bg-neutral-900/50 border border-neutral-800 rounded flex justify-between items-center"
                  >
                    <div>
                      <span className="text-neutral-300">{sub.name}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        sub.status === "approved" 
                          ? "bg-green-900 text-green-300"
                          : "bg-red-900 text-red-300"
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                    <span className="text-neutral-500 text-xs">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Venues Tab */}
      {activeTab === "venues" && (
        <div>
          <button
            onClick={() => setShowNewVenue(!showNewVenue)}
            className="mb-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded text-white font-medium"
          >
            + Add Venue
          </button>

          {showNewVenue && (
            <form onSubmit={handleCreateVenue} className="mb-6 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Venue name *"
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newVenue.address}
                  onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={newVenue.city}
                  onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading === "new"}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white disabled:opacity-50"
                >
                  {actionLoading === "new" ? "Creating..." : "Create Venue"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewVenue(false)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-neutral-400 border-b border-white/10">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.canonical_id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 text-white">{venue.name}</td>
                    <td className="px-3 py-2 text-neutral-400">{venue.address || "—"}</td>
                    <td className="px-3 py-2 text-neutral-400">{venue.city || "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDeleteVenue(venue.canonical_id, venue.name)}
                        disabled={actionLoading === venue.canonical_id}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
