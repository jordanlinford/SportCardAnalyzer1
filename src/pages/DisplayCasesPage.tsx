import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDisplayCases } from "@/hooks/display/useDisplayCases";
import { useDisplayCasesWithCards } from "@/hooks/useDisplayCasesWithCards";
import { useCards } from "@/hooks/useCards";
import { DisplayCase } from "@/types/display-case";
import { Card } from "@/types/Card";
import { CreateDisplayCaseModal } from "@/components/display-cases/CreateDisplayCaseModal";
import { EditDisplayCaseModal } from "@/components/display-cases/EditDisplayCaseModal";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useCardTagMatch } from "@/hooks/useCardTagMatch";
import { 
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { DisplayCaseDebugPreview } from "@/components/DisplayCaseDebugPreview";
import { DisplayCaseImageTest } from "@/components/DisplayCaseImageTest";
import DisplayCaseCard from "@/components/display-cases/DisplayCaseCard";
import { CardDebugDisplay } from "@/components/CardDebugDisplay";

const woodBg = "bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-amber-100";
const glassOverlay = "absolute inset-0 bg-gradient-to-b from-white/40 to-white/10 pointer-events-none rounded-lg";
const goldBorder = "border-4 border-yellow-700";
const shadow = "shadow-xl";
const badge = "absolute top-2 right-2 bg-yellow-700 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-md z-10";

export default function DisplayCasesPage() {
  // Use the original hook for mutations
  const { deleteDisplayCase, createDisplayCase, refetch } = useDisplayCases();
  
  // Use the new hook for display cases with cards
  const { displayCases, loading: isLoading } = useDisplayCasesWithCards();
  
  const { data: cards = [] } = useCards();
  const { user } = useAuth();
  const { isAdmin } = useUserSubscription();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalCase, setDeleteModalCase] = useState<DisplayCase | null>(null);
  const [editModalCase, setEditModalCase] = useState<DisplayCase | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [directDisplayCases, setDirectDisplayCases] = useState<any[]>([]);
  const [directCards, setDirectCards] = useState<any[]>([]);
  const [isDirectlyLoading, setIsDirectlyLoading] = useState(true);
  const navigate = useNavigate();
  const [showDebug, setShowDebug] = useState(false);

  // Example: If you have a display case limit, allow unlimited for admins
  const MAX_DISPLAY_CASES = 5; // or whatever your normal limit is
  const canCreateDisplayCase = isAdmin || displayCases.length < MAX_DISPLAY_CASES;

  // Directly fetch display cases and cards from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    
    setIsDirectlyLoading(true);
    
    // Get display cases
    const displayCasesRef = collection(db, "users", user.uid, "display_cases");
    const unsubscribe = onSnapshot(displayCasesRef, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDirectDisplayCases(cases);
      setIsDirectlyLoading(false);
    }, (error) => {
      console.error("Error fetching display cases:", error);
      setIsDirectlyLoading(false);
    });
    
    // Get cards from both paths
    const fetchCards = async () => {
      try {
        let allCards: any[] = [];
        
        // Try cards path
        try {
          const cardsRef = collection(db, "users", user.uid, "cards");
          const cardsSnapshot = await getDocs(cardsRef);
          if (!cardsSnapshot.empty) {
            const cardData = cardsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              // Ensure tags is an array
              tags: Array.isArray(doc.data().tags) ? doc.data().tags : []
            }));
            allCards = [...allCards, ...cardData];
          }
        } catch (e) {
          console.error("Error fetching from /cards:", e);
        }
        
        // Try collection path
        try {
          const collectionRef = collection(db, "users", user.uid, "collection");
          const collectionSnapshot = await getDocs(collectionRef);
          if (!collectionSnapshot.empty) {
            const collectionData = collectionSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              // Ensure tags is an array
              tags: Array.isArray(doc.data().tags) ? doc.data().tags : []
            }));
            allCards = [...allCards, ...collectionData];
          }
        } catch (e) {
          console.error("Error fetching from /collection:", e);
        }
        
        setDirectCards(allCards);
      } catch (error) {
        console.error("Error directly fetching cards:", error);
      }
    };
    
    fetchCards();
    
    return () => unsubscribe();
  }, [user]);
  
  // Direct Firestore delete function
  const directDeleteDisplayCase = async (id: string) => {
    if (!user?.uid) {
      toast.error("You must be logged in to delete a display case");
      return;
    }
    
    try {
      await deleteDoc(doc(db, "users", user.uid, "display_cases", id));
      toast.success("Display case deleted successfully");
      setDeleteModalCase(null);
    } catch (error) {
      console.error("Error deleting display case:", error);
      toast.error("Failed to delete display case");
    }
  };
  
  // Directly handle a delete request
  const handleDirectDelete = async () => {
    if (!deleteModalCase?.id) return;
    
    await directDeleteDisplayCase(deleteModalCase.id);
  };
  
  // Direct check if a card matches the display case tags
  const cardMatchesDisplayCase = (card: any, displayCase: any): boolean => {
    if (!card?.tags || !displayCase?.tags) return false;
    
    const cardTags = Array.isArray(card.tags) ? card.tags : [];
    const caseTags = Array.isArray(displayCase.tags) ? displayCase.tags : [];
    
    if (cardTags.length === 0 || caseTags.length === 0) return false;
    
    return cardTags.some((tag: string) => caseTags.includes(tag));
  };
  
  // Get matching cards for a display case
  const getMatchingCardsForCase = (displayCase: any): any[] => {
    return directCards.filter(card => cardMatchesDisplayCase(card, displayCase));
  };

  // Define CardThumbnails component for displaying card images
  const CardThumbnails = ({ displayCase }: { displayCase: DisplayCase }) => {
    const { cardImageUrls, hasMatches } = useCardTagMatch(cards, displayCase);
    
    if (cardImageUrls.length === 0) {
      return <div className="text-xs text-amber-400">No cards</div>;
    }
    
    return (
      <>
        {/* Glass overlay */}
        <div className={`${glassOverlay} z-0`} />
        {cardImageUrls.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt="Card thumbnail"
            className="w-16 h-24 object-cover rounded shadow-lg border-2 border-amber-200 bg-white/80 group-hover:shadow-yellow-400/40 transition-all duration-200 relative z-10"
            style={{ boxShadow: '0 2px 8px 0 rgba(0,0,0,0.18), 0 0 0 2px #eab30833', position: 'relative' }}
          />
        ))}
      </>
    );
  }

  const handleDelete = async () => {
    if (!deleteModalCase) return;
    try {
      await deleteDisplayCase(deleteModalCase.id);
      toast.success(`"${deleteModalCase.name}" was deleted`);
      setDeleteModalCase(null);
    } catch (error) {
      console.error("Error deleting display case:", error);
      toast.error("Failed to delete display case");
    }
  };

  const handleCardClick = (displayCase: DisplayCase, e: React.MouseEvent) => {
    // Navigate to display case details
    navigate(`/display-case/${displayCase.id}`);
  };

  const toggleDropdown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === id ? null : id);
  };

  // Close dropdown when clicking outside
  const handlePageClick = () => {
    if (openDropdownId) setOpenDropdownId(null);
  };

  // Simple card preview with pure CSS, no fancy stuff
  const SimpleCardPreview = ({ index }: { index: number }) => {
    // Basic colors
    const colors = ["#2563eb", "#dc2626", "#16a34a", "#ea580c"];
    const color = colors[index % colors.length];
    
    return (
      <div
        style={{
          width: '60px',
          height: '80px',
          backgroundColor: color,
          borderRadius: '6px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '16px'
        }}
      >
        {index + 1}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" onClick={handlePageClick}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Display Cases</h1>
        <div className="flex gap-2">
          <button
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow hover:bg-gray-300 transition"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
            onClick={() => setIsModalOpen(true)}
            disabled={!canCreateDisplayCase}
          >
            + Create Display Case
          </button>
        </div>
      </div>

      {/* Debug display */}
      {showDebug && (
        <div className="mb-8">
          <CardDebugDisplay />
        </div>
      )}

      {/* Login notification for unauthenticated users */}
      {!user && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-700">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium">Authentication Required</h3>
              <div className="mt-2 text-sm">
                <p>You are not logged in. Firebase security rules prevent accessing card data without authentication.</p>
                <p className="mt-1">Placeholder cards are being shown instead of actual card data.</p>
                <div className="mt-3">
                  <button 
                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1 px-4 rounded text-sm transition"
                    onClick={() => navigate('/login')}
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pure CSS and SVG Test - No external images */}
      <div className="mb-8 p-4 border-2 border-red-500 bg-white rounded-lg">
        <h2 className="text-xl font-bold mb-4">CSS & Color Block Cards (No External Images)</h2>
        
        {/* CSS-only cards */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Pure CSS Cards</h3>
          <div className="flex gap-4">
            {/* Simple colored box cards instead of complex CSS */}
            <div className="w-[100px] h-[150px] rounded-lg border-2 border-blue-500 bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-semibold">Card 1</span>
            </div>
            
            <div className="w-[100px] h-[150px] rounded-lg border-2 border-red-500 bg-red-100 flex items-center justify-center">
              <span className="text-red-700 font-semibold">Card 2</span>
            </div>
            
            <div className="w-[100px] h-[150px] rounded-lg border-2 border-green-500 bg-green-100 flex items-center justify-center">
              <span className="text-green-700 font-semibold">Card 3</span>
            </div>
          </div>
        </div>
        
        {/* Simple colored cards replacing SVG Cards */}
        <div>
          <h3 className="text-lg font-medium mb-3">Simple Color Block Cards</h3>
          <div className="flex gap-4">
            {/* Colored box 1 */}
            <div 
              style={{
                width: "100px",
                height: "150px",
                backgroundColor: "#0ea5e9",
                borderRadius: "8px",
                border: "2px solid #333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}
            >
              Blue Card
            </div>
            
            {/* Colored box 2 */}
            <div 
              style={{
                width: "100px",
                height: "150px",
                backgroundColor: "#dc2626",
                borderRadius: "8px",
                border: "2px solid #333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}
            >
              Red Card
            </div>
          </div>
        </div>
      </div>

      {/* New display cases with card images */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Display Cases With Real Card Images</h2>
        {isLoading ? (
          <div className="text-center p-4">Loading display cases...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {displayCases.map((displayCase) => (
              <DisplayCaseCard key={displayCase.id} displayCase={displayCase} />
            ))}
            {displayCases.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                No display cases found. Create your first display case to showcase your collection!
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Image Display Test Component */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Image Rendering Test</h2>
        <DisplayCaseImageTest />
      </div>

      {/* Create Display Case Modal */}
      {isModalOpen && (
        <CreateDisplayCaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalCase && (
        <Modal 
          isOpen={!!deleteModalCase}
          onClose={() => setDeleteModalCase(null)}
          title="Delete Display Case"
        >
          <div className="p-6">
            <p className="mb-4">Are you sure you want to delete "{deleteModalCase.name}"? This cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={(e) => {
                e.stopPropagation();
                setDeleteModalCase(null);
              }}>Cancel</Button>
              <Button variant="destructive" onClick={handleDirectDelete}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editModalCase && (
        <EditDisplayCaseModal
          isOpen={!!editModalCase}
          onClose={() => setEditModalCase(null)}
          displayCase={editModalCase}
        />
      )}

      {isDirectlyLoading ? (
        <div>Loading display cases...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {directDisplayCases.map((displayCase) => {
            // Set default values for missing metrics
            const likes = displayCase.likes || 0;
            const commentCount = displayCase.comments?.length || 0;
            const visits = displayCase.visits || 0;
            
            return (
              <div
                key={displayCase.id}
                className={`relative ${woodBg} ${goldBorder} ${shadow} rounded-2xl overflow-hidden cursor-pointer group transition-transform duration-200 hover:scale-105 hover:shadow-amber-300/60`}
                style={{ minHeight: 260 }}
                onClick={(e) => navigate(`/display-case/${displayCase.id}`)}
              >
                {/* Wood badge */}
                <span className={badge}>Wood</span>

                {/* Action Menu */}
                <div 
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative">
                    <button 
                      className="p-1.5 bg-white bg-opacity-75 rounded-full hover:bg-opacity-100"
                      onClick={(e) => toggleDropdown(displayCase.id, e)}
                      aria-label="Display case options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    <div className={`${openDropdownId === displayCase.id ? 'block' : 'hidden'} absolute left-0 top-8 bg-white shadow-lg rounded-md py-1 min-w-[150px] z-20`}>
                      <button 
                        className="w-full text-left px-4 py-1.5 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditModalCase(displayCase);
                          setOpenDropdownId(null);
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="w-full text-left px-4 py-1.5 hover:bg-gray-100 text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModalCase(displayCase);
                          setOpenDropdownId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-b border-amber-300/40">
                  <h2 className="text-lg font-bold mb-1 group-hover:text-yellow-800 transition">{displayCase.name}</h2>
                  <div className="text-xs text-amber-700 mb-2">
                    {displayCase.createdAt ? 
                      new Date(displayCase.createdAt.seconds ? 
                        displayCase.createdAt.seconds * 1000 : 
                        displayCase.createdAt).toLocaleDateString() 
                      : ''}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {displayCase.tags && displayCase.tags.length > 0 ? (
                      displayCase.tags.map((tag: string) => (
                        <span key={tag} className="bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded-full mr-1 border border-yellow-300">{tag}</span>
                      ))
                    ) : (
                      <span className="text-xs text-amber-400">No tags</span>
                    )}
                  </div>
                  
                  {/* Display metrics with static fallbacks */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-amber-600">
                    <span title="Likes">❤️ {likes}</span>
                    <span title="Comments">💬 {commentCount}</span>
                    <span title="Views">👁️ {visits}</span>
                  </div>

                  {/* Ultra-simple colored boxes for cards */}
                  <div className="flex gap-2 mt-3 mb-2">
                    {Array.from({ length: Math.min(displayCase.cardIds?.length || 3, 3) }).map((_, idx) => (
                      <SimpleCardPreview key={idx} index={idx} />
                    ))}
                    
                    {(displayCase.cardIds?.length || 0) > 3 && (
                      <div style={{
                        width: '60px',
                        height: '80px',
                        backgroundColor: '#d1d5db',
                        borderRadius: '6px',
                        color: '#4b5563',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        +{(displayCase.cardIds?.length || 0) - 3}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative flex flex-col p-4 bg-amber-50 rounded-b-2xl">
                  {/* DisplayCaseDebugPreview goes after our cards */}
                  <h3 className="text-sm font-semibold mb-2">Cards in this case:</h3>
                  <DisplayCaseDebugPreview cardIds={displayCase.cardIds} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 