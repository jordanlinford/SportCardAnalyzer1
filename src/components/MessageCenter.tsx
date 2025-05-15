import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  getDocs,
  DocumentData,
  QuerySnapshot,
  arrayRemove
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Heart, Check, Trash, MessageSquare, Loader2 } from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  displayCaseId: string;
  displayCaseName?: string;
  subject: string;
  message: string;
  timestamp: Date;
  read: boolean;
  deleted?: boolean;
}

interface Like {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  displayCaseId: string;
  displayCaseName?: string;
  timestamp: Date;
}

interface Comment {
  userId: string;
  userName: string;
  photoURL?: string;
  text: string;
  timestamp: Date;
  displayCaseId: string;
  displayCaseName?: string;
  originalIndex: number;
}

export function MessageCenter() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [likesLoading, setLikesLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("messages");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setMessagesLoading(false);
      setLikesLoading(false);
      setCommentsLoading(false);
      return;
    }

    setLoading(true);
    setMessagesLoading(true);
    setLikesLoading(true);
    setCommentsLoading(true);

    // Listen for messages where user is recipient
    const messagesRef = collection(db, "messages");
    const messagesQuery = query(
      messagesRef, 
      where("recipientId", "==", user.uid),
      where("deleted", "!=", true), 
      orderBy("deleted"), // Required for the != filter
      orderBy("timestamp", "desc")
    );

    const unsubMessages = onSnapshot(messagesQuery, async (snapshot) => {
      const messagesData: Message[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Skip deleted messages
        if (data.deleted === true) continue;
        
        // Get display case name if available
        let displayCaseName = "Unknown Display Case";
        try {
          // Try to get from public_display_cases first
          const displayCaseRef = doc(db, "public_display_cases", data.displayCaseId);
          const displayCaseSnap = await getDoc(displayCaseRef);
          
          if (displayCaseSnap.exists()) {
            displayCaseName = displayCaseSnap.data().name || "Unnamed Display Case";
          } else {
            // Try legacy path as fallback
            const legacyRef = doc(db, "displayCases", data.displayCaseId);
            const legacySnap = await getDoc(legacyRef);
            
            if (legacySnap.exists()) {
              displayCaseName = legacySnap.data().name || "Unnamed Display Case";
            }
          }
        } catch (error) {
          console.error("Error fetching display case name:", error);
        }
        
        messagesData.push({
          id: docSnapshot.id,
          senderId: data.senderId,
          senderName: data.senderName || "Anonymous",
          senderEmail: data.senderEmail || "unknown@example.com",
          displayCaseId: data.displayCaseId,
          displayCaseName,
          subject: data.subject || "No Subject",
          message: data.message || "",
          timestamp: data.timestamp?.toDate() || new Date(),
          read: data.read || false,
          deleted: data.deleted || false
        });
      }
      
      setMessages(messagesData);
      setMessagesLoading(false);
    }, (error) => {
      console.error("Error listening to messages:", error);
      setMessagesLoading(false);
    });

    // Fetch display cases and associated comments
    const fetchDisplayCasesAndComments = async () => {
      try {
        // Get display cases from public_display_cases collection
        const publicCasesRef = collection(db, "public_display_cases");
        const publicCasesQuery = query(publicCasesRef, where("userId", "==", user.uid));
        const publicCasesSnap = await getDocs(publicCasesQuery);
        
        const commentsData: Comment[] = [];
        
        for (const displayCaseDoc of publicCasesSnap.docs) {
          const displayCaseData = displayCaseDoc.data();
          const displayCaseName = displayCaseData.name || "Unnamed Display Case";
          
          // Process comments if they exist
          if (displayCaseData.comments && Array.isArray(displayCaseData.comments)) {
            displayCaseData.comments.forEach((comment: any, index: number) => {
              commentsData.push({
                userId: comment.userId || '',
                userName: comment.userName || 'Anonymous',
                photoURL: comment.photoURL || '',
                text: comment.text || '',
                timestamp: comment.timestamp?.toDate() || new Date(),
                displayCaseId: displayCaseDoc.id,
                displayCaseName,
                originalIndex: index
              });
            });
          }
        }
        
        // Sort by timestamp, newest first
        commentsData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setComments(commentsData);
      } catch (error) {
        console.error("Error fetching display cases comments:", error);
      } finally {
        setCommentsLoading(false);
      }
    };
    
    fetchDisplayCasesAndComments();

    // Listen for likes on user's display cases
    const likesRef = collection(db, "likes");

    // First get user's display cases
    const fetchDisplayCases = async () => {
      try {
        // Get display cases from public_display_cases collection
        const publicCasesRef = collection(db, "public_display_cases");
        const publicCasesQuery = query(publicCasesRef, where("userId", "==", user.uid));
        const publicCasesSnap = await getDocs(publicCasesQuery);
        
        const displayCaseIds = publicCasesSnap.docs.map(docItem => docItem.id);
        
        // If we have display cases, set up a listener for likes
        if (displayCaseIds.length > 0) {
          const likesQuery = query(
            likesRef, 
            where("displayCaseId", "in", displayCaseIds)
          );
          
          return onSnapshot(likesQuery, async (likesSnapshot) => {
            const likesData: Like[] = [];
            
            console.log(`Fetched ${likesSnapshot.docs.length} likes from Firestore`);
            
            for (const docSnapshot of likesSnapshot.docs) {
              const data = docSnapshot.data();
              
              // Get display case name
              let displayCaseName = "Unknown Display Case";
              try {
                const displayCaseRef = doc(db, "public_display_cases", data.displayCaseId);
                const displayCaseSnap = await getDoc(displayCaseRef);
                
                if (displayCaseSnap.exists()) {
                  displayCaseName = displayCaseSnap.data().name || "Unnamed Display Case";
                }
              } catch (error) {
                console.error("Error fetching display case name:", error);
              }
              
              likesData.push({
                id: docSnapshot.id,
                userId: data.userId,
                displayCaseId: data.displayCaseId,
                displayCaseName,
                timestamp: data.timestamp?.toDate() || new Date()
              });
            }
            
            console.log(`Processed ${likesData.length} likes for the UI`);
            setLikes(likesData);
            setLikesLoading(false);
          }, (error) => {
            console.error("Error listening to likes:", error);
            setLikesLoading(false);
          });
        } else {
          // No display cases, so no likes to fetch
          setLikesLoading(false);
          // Return a no-op function
          return () => {};
        }
      } catch (error) {
        console.error("Error fetching display cases:", error);
        setLikesLoading(false);
        // Return a no-op function
        return () => {};
      }
    };
    
    // Start fetching display cases and set up likes listener
    let unsubLikes = () => {};
    fetchDisplayCases().then(unsubscribe => {
      if (unsubscribe) {
        unsubLikes = unsubscribe;
      }
    });

    // Update loading state when all data fetching is complete
    const checkAllLoaded = () => {
      if (!messagesLoading && !likesLoading && !commentsLoading) {
        setLoading(false);
      }
    };

    // Set up interval to check loading state
    const loadingInterval = setInterval(checkAllLoaded, 500);

    return () => {
      unsubMessages();
      unsubLikes();
      clearInterval(loadingInterval);
    };
  }, [user]);

  // Update overall loading state whenever individual loading states change
  useEffect(() => {
    if (!messagesLoading && !likesLoading && !commentsLoading) {
      setLoading(false);
      console.log(`Loading complete - Messages: ${messages.length}, Likes: ${likes.length}, Comments: ${comments.length}`);
    }
  }, [messagesLoading, likesLoading, commentsLoading, messages.length, likes.length, comments.length]);

  const markAsRead = async (messageId: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, { read: true });
      toast.success("Message marked as read");
    } catch (error) {
      console.error("Error marking message as read:", error);
      toast.error("Failed to mark message as read");
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, { deleted: true });
      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const deleteComment = async (comment: Comment) => {
    try {
      const displayCaseRef = doc(db, "public_display_cases", comment.displayCaseId);
      const displayCaseSnap = await getDoc(displayCaseRef);
      
      if (displayCaseSnap.exists()) {
        const comments = displayCaseSnap.data().comments || [];
        
        // The index in the array might have changed, so we need to find the matching comment
        const commentToRemove = comments[comment.originalIndex];
        
        if (commentToRemove) {
          await updateDoc(displayCaseRef, {
            comments: arrayRemove(commentToRemove)
          });
          
          // Update local state
          setComments(prevComments => 
            prevComments.filter(c => 
              !(c.displayCaseId === comment.displayCaseId && 
                c.originalIndex === comment.originalIndex)
            )
          );
          
          toast.success("Comment deleted successfully");
        } else {
          toast.error("Comment not found");
        }
      } else {
        toast.error("Display case not found");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Messages & Notifications</CardTitle>
          <CardDescription>Please sign in to view your messages and notifications</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Messages & Notifications</span>
          {!loading && (
            <div className="flex items-center gap-2">
              {messages.filter(m => !m.read).length > 0 && (
                <Badge className="bg-red-500">{messages.filter(m => !m.read).length} unread</Badge>
              )}
              {likes.length > 0 && (
                <Badge className="bg-blue-500 flex items-center">
                  <Heart className="w-3 h-3 mr-1" fill="currentColor" />
                  <span>{likes.length} likes</span>
                </Badge>
              )}
              {comments.length > 0 && (
                <Badge className="bg-green-500 flex items-center">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  <span>{comments.length} comments</span>
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Manage comments, likes, and messages from other users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="messages" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="messages" className="flex-1">
              <MessageCircle className="w-4 h-4 mr-2" />
              Messages
              {messages.filter(m => !m.read).length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white px-2">{messages.filter(m => !m.read).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex-1">
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
              {comments.length > 0 && (
                <Badge className="ml-2 bg-green-500 text-white px-2">{comments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex-1">
              <Heart className="w-4 h-4 mr-2" fill={likes.length > 0 ? "currentColor" : "none"} />
              Likes
              {likes.length > 0 && (
                <Badge className="ml-2 bg-blue-500 text-white px-2">{likes.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="messages" className="space-y-4">
            {messagesLoading ? (
              <div className="text-center py-8 flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <span className="text-gray-500">Loading messages...</span>
              </div>
            ) : messages.length > 0 ? (
              messages.map(message => (
                <div 
                  key={message.id} 
                  className={`border rounded-lg p-4 ${!message.read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{message.subject}</h3>
                      <p className="text-sm text-gray-500">
                        From: {message.senderName} • {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {!message.read && (
                      <Badge variant="secondary">New</Badge>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{message.message}</p>
                  <p className="text-sm text-gray-500 mb-3">
                    Regarding: {message.displayCaseName}
                  </p>
                  <div className="flex justify-end space-x-2">
                    {!message.read && (
                      <Button variant="outline" size="sm" onClick={() => markAsRead(message.id)}>
                        <Check className="w-4 h-4 mr-1" /> Mark as Read
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => deleteMessage(message.id)}>
                      <Trash className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No messages yet
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="comments" className="space-y-4">
            {commentsLoading ? (
              <div className="text-center py-8 flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <span className="text-gray-500">Loading comments...</span>
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{comment.userName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-3">{comment.text}</p>
                  <p className="text-sm text-gray-500 mb-3">
                    On display case: {comment.displayCaseName}
                  </p>
                  <div className="flex justify-end">
                    <Button variant="destructive" size="sm" onClick={() => deleteComment(comment)}>
                      <Trash className="w-4 h-4 mr-1" /> Delete Comment
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No comments on your display cases yet
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="likes" className="space-y-4">
            {likesLoading ? (
              <div className="text-center py-8 flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <span className="text-gray-500">Loading likes...</span>
              </div>
            ) : likes.length > 0 ? (
              likes.map(like => (
                <div key={like.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-2">
                    <Heart className="w-5 h-5 text-red-500 mr-2" fill="currentColor" />
                    <span className="font-medium">Someone liked your display case</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {formatDistanceToNow(like.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="px-2 py-1 bg-blue-50 border border-blue-100 rounded-md mb-2">
                    <p className="text-sm font-medium text-blue-800">
                      Display Case: {like.displayCaseName}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Heart className="w-10 h-10 mx-auto mb-4 text-gray-300" />
                <p>No likes yet</p>
                <p className="text-sm mt-2">When someone likes your display cases, it will appear here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-sm text-gray-500">
        Public activity on your display cases will appear here.
      </CardFooter>
    </Card>
  );
} 